from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from app.agents.state import TurnState
from app.agents.schemas import InterviewerAction
from app.services.rag_engine import get_resume_retriever
from app.services.llm_config import resilient_llm as llm

interviewer_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are the Lead Technical Interviewer at RecruitAI conducting a structured, adaptive interview.
You adhere strictly to an 8-Phase Protocol:
1. 'introduction' - Welcoming, build rapport, ask for brief self-introduction.
2. 'screening'    - Check core requirements from the Job Description.
3. 'adaptation'   - Adjust question difficulty; offer hints or simpler framing if candidate is hesitant.
4. 'follow_up'    - Probe deeper into candidate's previous answer details.
5. 'deep_dive'    - Drill into concrete resume projects, architecture decisions, and tech stack choices.
6. 'scenario'     - Real-world behavioral or situational problem solving / edge cases.
7. 'feedback'     - Provide concise encouraging interim observation and transition to final remarks.
8. 'closing'      - Thank the candidate, summarize next steps, and conclude the interview.

Current State Context:
- Current Phase: {current_phase}
- Job Description: {job_description}
- Relevant Resume Context: {resume_context}
- Candidate Sentiment: {sentiment}
- Hesitation Detected: {hesitation_detected}
- Hint Recommended: {recommend_hint}

Recent Conversation History:
{history_summary}

Candidate's Latest Response:
"{latest_user_turn}"

Instructions:
- If recommend_hint is True or hesitation_detected is True, switch action to 'provide_hint' or 'adaptation' with an encouraging guiding prompt.
- If candidate provided a shallow response, use 'probe_deeper' or 'follow_up'.
- If candidate provided a strong detailed answer, transition logically towards the next phase.
- If current phase is 'feedback' and candidate responded, transition to 'closing' with 'close_interview'.
- Keep your conversational response spoken, concise, and realistic (1-3 sentences max).
"""
    ),
    (
        "human",
        "Generate the next interviewer action and spoken response for phase '{current_phase}'."
    )
])


def retrieve_candidate_context(state: TurnState) -> dict:
    """Retrieves session-specific resume and JD context via pgvector store."""
    session_id = state.get("session_id", "")
    query = state.get("latest_user_turn", "") or state.get("job_description", "")

    if not session_id or not query:
        return {"resume_context": state.get("resume_context", "")}

    try:
        retriever = get_resume_retriever(session_id=session_id, k=3)
        docs = retriever.invoke(query)
        context_str = "\n".join([d.page_content for d in docs])
        return {"resume_context": context_str}
    except Exception:
        return {"resume_context": state.get("resume_context", "")}


def decide_action(state: TurnState) -> dict:
    """Invokes LLM with structured output to determine the next conversational question and phase."""
    transcript = state.get("transcript_so_far", [])
    recent_history = transcript[-4:] if transcript else []
    history_str = "\n".join([f"{t.get('role', 'speaker')}: {t.get('content', '')}" for t in recent_history])

    try:
        chain = interviewer_prompt | llm.with_structured_output(InterviewerAction)
        result: InterviewerAction = chain.invoke({
            "current_phase": state.get("current_phase", "introduction"),
            "job_description": state.get("job_description", "Software Engineer"),
            "resume_context": state.get("resume_context", ""),
            "sentiment": state.get("sentiment", "neutral"),
            "hesitation_detected": state.get("hesitation_detected", False),
            "recommend_hint": state.get("recommend_hint", False),
            "history_summary": history_str or "No previous turns.",
            "latest_user_turn": state.get("latest_user_turn", ""),
        })

        is_complete = (
            result.next_phase == "closing" or
            result.action == "close_interview" or
            state.get("current_phase") == "closing"
        )

        return {
            "next_action": {
                "action": result.action,
                "question": result.question,
                "next_phase": result.next_phase,
                "reasoning": result.reasoning,
            },
            "current_phase": result.next_phase,
            "session_complete": is_complete,
        }
    except Exception as e:
        # Fallback deterministic turn generation
        current_p = state.get("current_phase", "introduction")
        fallback_action = {
            "action": "ask_question",
            "question": "Could you elaborate more on your experience with this tech stack?",
            "next_phase": current_p,
            "reasoning": f"Fallback due to: {e}",
        }
        return {
            "next_action": fallback_action,
            "current_phase": current_p,
            "session_complete": current_p == "closing",
        }


# Build LangGraph Subgraph
interviewer_builder = StateGraph(TurnState)
interviewer_builder.add_node("retrieve_candidate_context", retrieve_candidate_context)
interviewer_builder.add_node("decide_action", decide_action)

interviewer_builder.set_entry_point("retrieve_candidate_context")
interviewer_builder.add_edge("retrieve_candidate_context", "decide_action")
interviewer_builder.add_edge("decide_action", END)

interviewer_graph = interviewer_builder.compile()

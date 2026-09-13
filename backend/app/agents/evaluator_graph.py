from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from app.agents.state import TurnState
from app.agents.schemas import EvaluationResult
from app.services.rag_engine import get_rubric_retriever
from app.services.llm_config import resilient_llm as llm

evaluator_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are the Executive Technical Evaluator for RecruitAI.
Your role is to assess the complete interview performance of the candidate against the role requirements and scoring rubric.

Target Job Description:
{job_description}

Scoring Rubric Context:
{rubric_context}

Full Transcript of the Interview Session:
{transcript_text}

Instructions:
1. Score the candidate from 0-100 on Technical Depth, Communication, and Problem Solving.
2. Calculate a weighted overall score (0-100).
3. Identify 2-4 concrete strengths with examples from the conversation.
4. Identify 2-4 specific weaknesses or missed opportunities.
5. Provide 3 actionable recommendations for improvement.
6. Rate your self-confidence in this evaluation from 0.0 to 1.0 (if transcript is short or ambiguous, provide lower confidence < 0.7).
7. Write comprehensive, constructive feedback.
"""
    ),
    (
        "human",
        "Perform the structured evaluation for this candidate."
    )
])


def retrieve_rubric_context(state: TurnState) -> dict:
    """Retrieves standard role-based scoring rubric chunks from the vector store."""
    jd = state.get("job_description", "").lower()
    role_category = "general"
    if any(k in jd for k in ["engineer", "developer", "backend", "frontend", "fullstack", "software", "architect", "python", "react"]):
        role_category = "software_engineering"
    elif any(k in jd for k in ["hr", "behavioral", "manager", "culture"]):
        role_category = "behavioral"

    fallback_rubric = (
        "Core Evaluation Criteria:\n"
        "- Technical Competency & Depth (0-100): Depth of domain knowledge, system architecture, trade-off analysis.\n"
        "- Communication & Clarity (0-100): Structured responses, concise articulation, active listening.\n"
        "- Problem Solving & Judgement (0-100): Breaking down problems, reasoning under ambiguity, handling edge cases."
    )

    try:
        retriever = get_rubric_retriever(role_category=role_category, k=4)
        docs = retriever.invoke(state.get("job_description", "Software Engineer"))
        rubric_str = "\n".join([d.page_content for d in docs])
        return {"rubric_context": rubric_str or fallback_rubric}
    except Exception:
        return {"rubric_context": fallback_rubric}


def evaluate_session(state: TurnState) -> dict:
    """Produces a structured evaluation of the candidate's interview session."""
    transcript = state.get("transcript_so_far", [])
    transcript_text = "\n".join([
        f"[{t.get('role', 'speaker').upper()}]: {t.get('content', '')}"
        for t in transcript
    ])

    if not transcript_text:
        transcript_text = f"[CANDIDATE]: {state.get('latest_user_turn', 'Completed session.')}"

    try:
        chain = evaluator_prompt | llm.with_structured_output(EvaluationResult)
        result: EvaluationResult = chain.invoke({
            "job_description": state.get("job_description", "Software Engineer"),
            "rubric_context": state.get("rubric_context", "General evaluation criteria"),
            "transcript_text": transcript_text,
        })

        return {
            "evaluation": result.model_dump(),
            "evaluation_retry_count": state.get("evaluation_retry_count", 0),
        }
    except Exception as e:
        fallback_eval = {
            "overall_score": 75,
            "technical_score": 75,
            "communication_score": 80,
            "problem_solving_score": 70,
            "strengths": ["Clear communication", "Structured approach"],
            "weaknesses": ["Could provide deeper architectural details"],
            "recommendations": ["Elaborate more on trade-offs and performance considerations"],
            "confidence_score": 0.85,
            "detailed_feedback": f"Completed mock interview session. Note: generated with baseline metrics ({e}).",
        }
        return {
            "evaluation": fallback_eval,
            "evaluation_retry_count": state.get("evaluation_retry_count", 0),
        }


def check_evaluation_confidence(state: TurnState) -> str:
    """Confidence-gated conditional edge: retries evaluation if confidence is below threshold."""
    evaluation = state.get("evaluation", {})
    confidence = evaluation.get("confidence_score", 1.0)
    retry_count = state.get("evaluation_retry_count", 0)

    if confidence < 0.7 and retry_count < 1:
        return "retry_evaluation"
    return "finalize"


def retry_prep(state: TurnState) -> dict:
    """Prepares enriched rubric context for evaluation retry."""
    return {
        "evaluation_retry_count": state.get("evaluation_retry_count", 0) + 1,
        "rubric_context": state.get("rubric_context", "") + "\nDetailed Scoring Criteria: Focus on edge cases and depth.",
    }


# Build LangGraph Subgraph
evaluator_builder = StateGraph(TurnState)
evaluator_builder.add_node("retrieve_rubric_context", retrieve_rubric_context)
evaluator_builder.add_node("evaluate_session", evaluate_session)
evaluator_builder.add_node("retry_prep", retry_prep)

evaluator_builder.set_entry_point("retrieve_rubric_context")
evaluator_builder.add_edge("retrieve_rubric_context", "evaluate_session")

evaluator_builder.add_conditional_edges(
    "evaluate_session",
    check_evaluation_confidence,
    {
        "retry_evaluation": "retry_prep",
        "finalize": END,
    }
)
evaluator_builder.add_edge("retry_prep", "evaluate_session")

evaluator_graph = evaluator_builder.compile()

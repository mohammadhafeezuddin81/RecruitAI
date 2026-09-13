from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from app.agents.state import TurnState
from app.agents.schemas import ObserverOutput
from app.services.llm_config import resilient_llm as llm

observer_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are an Expert Cognitive Observer in an AI interview system.
Your job is to analyze the candidate's latest response, speech hesitation, and psychological state.

Inputs provided:
- Candidate's latest response: "{latest_user_turn}"
- Silence duration / pause: {silence_duration_ms} ms
- Current interview phase: "{current_phase}"

Guidelines:
1. Determine sentiment: confident, nervous, hesitant, neutral, frustrated, or articulate.
2. Flag hesitation if the candidate pauses significantly (>2000ms), uses excessive filler words ("um", "uh", "like"), stutters, or expresses uncertainty ("I don't know", "not sure").
3. Flag recommend_hint if the candidate is clearly stuck, struggling on a technical concept, or explicitly asking for guidance.
4. Provide a brief 1-sentence reasoning for your observation.
"""
    ),
    (
        "human",
        "Analyze the candidate turn: \"{latest_user_turn}\" with silence {silence_duration_ms}ms in phase '{current_phase}'."
    )
])


def analyze_turn(state: TurnState) -> dict:
    """Runs perception analysis on the candidate's latest utterance."""
    latest_turn = state.get("latest_user_turn", "")
    silence_ms = state.get("silence_duration_ms", 0)
    current_phase = state.get("current_phase", "introduction")

    # If answer is empty or silence > 2000ms, immediately detect hesitation
    if not latest_turn.strip():
        return {
            "sentiment": "hesitant",
            "hesitation_detected": True,
            "recommend_hint": True,
        }

    try:
        chain = observer_prompt | llm.with_structured_output(ObserverOutput)
        result: ObserverOutput = chain.invoke({
            "latest_user_turn": latest_turn,
            "silence_duration_ms": silence_ms,
            "current_phase": current_phase,
        })
        hesitation = result.hesitation_detected or (silence_ms >= 2000)
        return {
            "sentiment": result.sentiment,
            "hesitation_detected": hesitation,
            "recommend_hint": result.recommend_hint,
        }
    except Exception as e:
        # Fallback heuristic if LLM call is unavailable
        is_hesitant = silence_ms >= 2000 or any(
            w in latest_turn.lower() for w in ["i don't know", "not sure", "um", "uh"]
        )
        return {
            "sentiment": "hesitant" if is_hesitant else "neutral",
            "hesitation_detected": is_hesitant,
            "recommend_hint": is_hesitant,
        }


# Build LangGraph Subgraph
observer_builder = StateGraph(TurnState)
observer_builder.add_node("analyze_turn", analyze_turn)
observer_builder.set_entry_point("analyze_turn")
observer_builder.add_edge("analyze_turn", END)

observer_graph = observer_builder.compile()

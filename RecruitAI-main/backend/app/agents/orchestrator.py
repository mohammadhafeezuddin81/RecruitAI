from langgraph.graph import StateGraph, END
from app.agents.state import TurnState
from app.agents.observer_graph import observer_graph
from app.agents.interviewer_graph import interviewer_graph
from app.agents.evaluator_graph import evaluator_graph
from app.services.database import save_turn, save_evaluation


def run_observer_node(state: TurnState) -> TurnState:
    """Executes the Observer subgraph to analyze candidate perception."""
    result = observer_graph.invoke(state)
    return {**state, **result}


def run_interviewer_node(state: TurnState) -> TurnState:
    """Executes the Interviewer subgraph to progress the 8-phase FSM."""
    result = interviewer_graph.invoke(state)
    return {**state, **result}


def persist_turn_node(state: TurnState) -> TurnState:
    """Persists conversational turn into Firestore transcript."""
    save_turn(state)
    return state


def run_evaluator_node(state: TurnState) -> TurnState:
    """Executes the Evaluator subgraph when the interview concludes."""
    result = evaluator_graph.invoke(state)
    updated = {**state, **result}
    if updated.get("evaluation"):
        save_evaluation(updated, updated["evaluation"])
    return updated


def route_after_interviewer(state: TurnState) -> str:
    """Determines whether to trigger evaluation (on close) or persist ongoing turn."""
    if state.get("session_complete") or state.get("current_phase") == "closing":
        return "evaluator"
    return "persist_turn"


# Master Orchestrator Graph Construction
orchestrator_builder = StateGraph(TurnState)

orchestrator_builder.add_node("observer", run_observer_node)
orchestrator_builder.add_node("interviewer", run_interviewer_node)
orchestrator_builder.add_node("persist_turn", persist_turn_node)
orchestrator_builder.add_node("evaluator", run_evaluator_node)

orchestrator_builder.set_entry_point("observer")
orchestrator_builder.add_edge("observer", "interviewer")

orchestrator_builder.add_conditional_edges(
    "interviewer",
    route_after_interviewer,
    {
        "evaluator": "evaluator",
        "persist_turn": "persist_turn",
    }
)

orchestrator_builder.add_edge("persist_turn", END)
orchestrator_builder.add_edge("evaluator", END)

orchestrator_graph = orchestrator_builder.compile()

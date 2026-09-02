import pytest
from unittest.mock import patch, MagicMock
from app.agents.state import TurnState
from app.agents.schemas import ObserverOutput, InterviewerAction, EvaluationResult
from app.agents.orchestrator import orchestrator_graph, route_after_interviewer


def test_route_after_interviewer_ongoing():
    state: TurnState = {
        "current_phase": "screening",
        "session_complete": False,
    }
    assert route_after_interviewer(state) == "persist_turn"


def test_route_after_interviewer_closing():
    state: TurnState = {
        "current_phase": "closing",
        "session_complete": True,
    }
    assert route_after_interviewer(state) == "evaluator"


@patch("app.agents.observer_graph.observer_prompt")
@patch("app.agents.interviewer_graph.interviewer_prompt")
@patch("app.services.database.save_turn")
def test_orchestrator_turn_flow(mock_save_turn, mock_interviewer_prompt, mock_observer_prompt):
    # Mock observer structured output
    mock_obs_chain = MagicMock()
    mock_obs_chain.invoke.return_value = ObserverOutput(
        sentiment="confident",
        hesitation_detected=False,
        recommend_hint=False,
        reasoning="Candidate answered clearly",
    )
    mock_observer_prompt.__or__.return_value = mock_obs_chain

    # Mock interviewer structured output
    mock_int_chain = MagicMock()
    mock_int_chain.invoke.return_value = InterviewerAction(
        action="ask_question",
        question="What database indexing strategies do you recommend?",
        next_phase="screening",
        reasoning="Proceed with screening",
    )
    mock_interviewer_prompt.__or__.return_value = mock_int_chain

    initial_state: TurnState = {
        "session_id": "session-xyz",
        "user_id": "user-abc",
        "transcript_so_far": [],
        "latest_user_turn": "I have extensive experience building scalable REST APIs.",
        "silence_duration_ms": 500,
        "current_phase": "introduction",
        "job_description": "Senior Backend Developer",
        "session_complete": False,
    }

    result = orchestrator_graph.invoke(initial_state)

    assert result["current_phase"] == "screening"
    assert result["next_action"]["action"] == "ask_question"
    assert "indexing" in result["next_action"]["question"]
    mock_save_turn.assert_called_once()

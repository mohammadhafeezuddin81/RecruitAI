import pytest
from app.services.database import (
    load_session_state,
    create_session,
    save_turn,
    save_evaluation,
    get_analytics,
    get_user_profile,
    update_profile,
)


def test_load_session_state_raises_on_missing_session():
    with pytest.raises(ValueError):
        load_session_state("nonexistent-test-session-id")


def test_create_and_load_session_flow():
    session_id = create_session(
        user_id="test_candidate_1",
        job_description="Staff Software Engineer - Distributed Systems",
        mode="technical",
    )
    assert session_id.startswith("session-")

    state = load_session_state(session_id)
    assert state["session_id"] == session_id
    assert state["user_id"] == "test_candidate_1"
    assert state["current_phase"] == "introduction"
    assert state["session_complete"] is False


def test_save_turn_and_evaluation():
    session_id = create_session(
        user_id="test_candidate_2",
        job_description="Full Stack Engineer",
        mode="technical",
    )

    turn_state = {
        "session_id": session_id,
        "latest_user_turn": "I specialize in PostgreSQL query optimization and indexing.",
        "sentiment": "confident",
        "hesitation_detected": False,
        "current_phase": "screening",
        "next_action": {
            "action": "ask_question",
            "question": "Can you discuss B-Tree vs GIN indexing trade-offs?",
        },
    }
    save_turn(turn_state)

    state = load_session_state(session_id)
    assert len(state["transcript_so_far"]) >= 2
    assert state["transcript_so_far"][0]["role"] == "candidate"
    assert state["transcript_so_far"][1]["role"] == "interviewer"

    evaluation_payload = {
        "overall_score": 88,
        "technical_score": 90,
        "communication_score": 85,
        "problem_solving_score": 88,
        "strengths": ["Deep indexing knowledge"],
    }
    save_evaluation(state, evaluation_payload)

    analytics = get_analytics("test_candidate_2")
    assert analytics["total_interviews"] >= 1
    assert analytics["status"] == "ok"


def test_profile_persistence():
    user_id = "user_pg_test_99"
    update_profile(user_id, {
        "name": "Maria Garcia",
        "email": "maria@example.com",
        "linkedin": "https://linkedin.com/in/mariagarcia",
    })

    profile = get_user_profile(user_id)
    assert profile["name"] == "Maria Garcia"
    assert profile["email"] == "maria@example.com"

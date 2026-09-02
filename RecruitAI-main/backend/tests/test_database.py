import pytest
from unittest.mock import patch, MagicMock
from app.services.database import load_session_state, create_session, save_turn, save_evaluation


@patch("app.services.database.db")
def test_load_session_state_raises_on_missing_session(mock_db):
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with pytest.raises(ValueError):
        load_session_state("nonexistent-id")


@patch("app.services.database.db")
def test_load_session_state_success(mock_db):
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "user_id": "user_123",
        "job_description": "Full Stack Engineer",
        "current_phase": "screening",
        "transcript_so_far": [{"role": "candidate", "content": "Hello"}],
        "session_complete": False,
    }
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    state = load_session_state("valid-session-id")
    assert state["session_id"] == "valid-session-id"
    assert state["user_id"] == "user_123"
    assert state["current_phase"] == "screening"
    assert len(state["transcript_so_far"]) == 1
    assert state["session_complete"] is False


@patch("app.services.database.db")
def test_create_session(mock_db):
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "new-session-789"
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    session_id = create_session(user_id="user_abc", job_description="Backend Dev", mode="technical")
    assert session_id == "new-session-789"
    mock_doc_ref.set.assert_called_once()

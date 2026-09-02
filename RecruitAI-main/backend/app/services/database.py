import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import firebase_admin
from firebase_admin import credentials, firestore
from app.agents.state import TurnState

# Initialize Firebase Admin SDK
db = None
try:
    if not firebase_admin._apps:
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
            firebase_admin.initialize_app(cred)
        else:
            # Attempt default application credentials
            try:
                firebase_admin.initialize_app()
            except Exception:
                pass
    if firebase_admin._apps:
        db = firestore.client()
except Exception as e:
    print(f"Warning: Firestore initialization skipped or running in mock mode: {e}")
    db = None

SESSIONS = "interview_sessions"


def create_session(user_id: str, job_description: str, mode: str) -> str:
    """Creates a new interview session in Firestore and returns the generated session ID."""
    if db is None:
        import uuid
        return f"mock-session-{uuid.uuid4().hex[:8]}"

    doc_ref = db.collection(SESSIONS).document()
    doc_ref.set({
        "user_id": user_id,
        "job_description": job_description,
        "mode": mode,
        "current_phase": "introduction",
        "transcript_so_far": [],
        "session_complete": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    return doc_ref.id


def load_session_state(session_id: str) -> TurnState:
    """Loads current session state from Firestore and formats it into a TurnState dict."""
    if db is None:
        return {
            "session_id": session_id,
            "user_id": "test_user",
            "transcript_so_far": [],
            "latest_user_turn": "",
            "silence_duration_ms": 0,
            "current_phase": "introduction",
            "resume_context": "",
            "job_description": "",
            "sentiment": None,
            "hesitation_detected": None,
            "recommend_hint": None,
            "next_action": None,
            "session_complete": False,
        }

    doc = db.collection(SESSIONS).document(session_id).get()
    if not doc.exists:
        raise ValueError(f"Session {session_id} not found")
    data = doc.to_dict() or {}
    return {
        "session_id": session_id,
        "user_id": data.get("user_id", ""),
        "transcript_so_far": data.get("transcript_so_far", []),
        "latest_user_turn": "",
        "silence_duration_ms": 0,
        "current_phase": data.get("current_phase", "introduction"),
        "resume_context": "",
        "job_description": data.get("job_description", ""),
        "sentiment": None,
        "hesitation_detected": None,
        "recommend_hint": None,
        "next_action": None,
        "session_complete": data.get("session_complete", False),
    }


def save_session_state(session_id: str, state: TurnState) -> None:
    """Updates the high-level session status and current interview phase."""
    if db is None:
        return

    db.collection(SESSIONS).document(session_id).update({
        "current_phase": state.get("current_phase", "introduction"),
        "session_complete": state.get("session_complete", False),
        "updated_at": datetime.now(timezone.utc),
    })


def save_turn(state: TurnState) -> None:
    """Appends the latest candidate turn + agent decision to the session's transcript array."""
    session_id = state.get("session_id")
    if not session_id or db is None:
        return

    turn_entry = {
        "role": "candidate",
        "content": state.get("latest_user_turn", ""),
        "sentiment": state.get("sentiment"),
        "hesitation_detected": state.get("hesitation_detected"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    action_entry = {
        "role": "interviewer",
        "content": (state.get("next_action") or {}).get("question", ""),
        "action": (state.get("next_action") or {}).get("action"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    db.collection(SESSIONS).document(session_id).update({
        "transcript_so_far": firestore.ArrayUnion([turn_entry, action_entry]),
        "current_phase": state.get("current_phase", "introduction"),
        "updated_at": datetime.now(timezone.utc),
    })


def save_evaluation(state: TurnState, evaluation_result: dict) -> None:
    """Stores the final evaluation report and marks the session as complete."""
    session_id = state.get("session_id")
    if not session_id or db is None:
        return

    db.collection(SESSIONS).document(session_id).update({
        "evaluation": evaluation_result,
        "evaluated_at": datetime.now(timezone.utc),
        "session_complete": True,
        "updated_at": datetime.now(timezone.utc),
    })


# --- Legacy / Dashboard helpers for backward compatibility ---
def get_analytics(user_id: str) -> Dict[str, Any]:
    """Fetches past interview stats for a candidate dashboard."""
    if db is None:
        return {"total_sessions": 0, "history": []}
    try:
        docs = db.collection(SESSIONS).where("user_id", "==", user_id).stream()
        history = [doc.to_dict() for doc in docs]
        return {
            "total_sessions": len(history),
            "history": history,
        }
    except Exception as e:
        return {"total_sessions": 0, "history": [], "error": str(e)}


def update_profile(user_id: str, profile_data: dict) -> None:
    """Updates candidate profile in Firestore."""
    if db is None:
        return
    try:
        db.collection("users").document(user_id).set(profile_data, merge=True)
    except Exception:
        pass
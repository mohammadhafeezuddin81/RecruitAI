"""
Database Service for RecruitAI.
Connects to PostgreSQL (Supabase) for session state, turn transcripts,
analytics, and candidate profiles. Includes automatic in-memory fallback
when DATABASE_URL is not configured for local dev and unit testing.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.agents.state import TurnState

logger = logging.getLogger("recruitai.database")

# In-memory store for offline development, local mock mode, and unit tests
_in_memory_sessions: Dict[str, dict] = {}
_in_memory_profiles: Dict[str, dict] = {}

DATABASE_URL = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("SUPABASE_DB_URL")
    or os.environ.get("POSTGRES_URL")
)

# If URL starts with postgres://, normalize to postgresql:// for SQLAlchemy/psycopg
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

db_engine = None
db = None  # Backward compatibility pointer for test mocking

if DATABASE_URL:
    try:
        from sqlalchemy import create_engine, text
        db_engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        # Verify connection and self-provision schema
        with db_engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS interview_sessions (
                    session_id VARCHAR(128) PRIMARY KEY,
                    user_id VARCHAR(128) NOT NULL,
                    job_description TEXT,
                    mode VARCHAR(64) DEFAULT 'technical',
                    current_phase VARCHAR(64) DEFAULT 'introduction',
                    transcript_so_far JSONB DEFAULT '[]'::jsonb,
                    evaluation JSONB,
                    session_complete BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS users (
                    user_id VARCHAR(128) PRIMARY KEY,
                    name VARCHAR(256),
                    email VARCHAR(256),
                    linkedin VARCHAR(512),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """))
            conn.commit()
        db = db_engine
        logger.info("Successfully connected to PostgreSQL (Supabase) and provisioned tables.")
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed. Running with in-memory persistence fallback: {e}")
        db_engine = None
        db = None


def create_session(user_id: str, job_description: str, mode: str) -> str:
    """Creates a new interview session in PostgreSQL (or in-memory mock) and returns the session ID."""
    import uuid
    session_id = f"session-{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    if db_engine is None:
        _in_memory_sessions[session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "job_description": job_description,
            "mode": mode,
            "current_phase": "introduction",
            "transcript_so_far": [],
            "evaluation": None,
            "session_complete": False,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        return session_id

    try:
        from sqlalchemy import text
        with db_engine.connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO interview_sessions (session_id, user_id, job_description, mode, current_phase, transcript_so_far, session_complete)
                    VALUES (:session_id, :user_id, :job_description, :mode, 'introduction', '[]'::jsonb, FALSE)
                """),
                {
                    "session_id": session_id,
                    "user_id": user_id,
                    "job_description": job_description,
                    "mode": mode,
                },
            )
            conn.commit()
        return session_id
    except Exception as e:
        logger.error(f"Error creating session in Postgres: {e}")
        _in_memory_sessions[session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "job_description": job_description,
            "mode": mode,
            "current_phase": "introduction",
            "transcript_so_far": [],
            "session_complete": False,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        return session_id


def load_session_state(session_id: str) -> TurnState:
    """Loads current session state from database (or in-memory fallback) into TurnState."""
    if db_engine is None:
        if session_id in _in_memory_sessions:
            data = _in_memory_sessions[session_id]
            return {
                "session_id": session_id,
                "user_id": data.get("user_id", "test_user"),
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
        raise ValueError(f"Session {session_id} not found")

    try:
        from sqlalchemy import text
        with db_engine.connect() as conn:
            result = conn.execute(
                text("SELECT * FROM interview_sessions WHERE session_id = :session_id"),
                {"session_id": session_id},
            ).mappings().first()

            if not result:
                if session_id in _in_memory_sessions:
                    return load_session_state_from_memory(session_id)
                raise ValueError(f"Session {session_id} not found")

            transcript = result.get("transcript_so_far") or []
            if isinstance(transcript, str):
                transcript = json.loads(transcript)

            return {
                "session_id": session_id,
                "user_id": result.get("user_id", ""),
                "transcript_so_far": transcript,
                "latest_user_turn": "",
                "silence_duration_ms": 0,
                "current_phase": result.get("current_phase", "introduction"),
                "resume_context": "",
                "job_description": result.get("job_description", ""),
                "sentiment": None,
                "hesitation_detected": None,
                "recommend_hint": None,
                "next_action": None,
                "session_complete": bool(result.get("session_complete", False)),
            }
    except ValueError:
        raise
    except Exception as e:
        logger.warning(f"Failed to query database, checking in-memory fallback: {e}")
        if session_id in _in_memory_sessions:
            return load_session_state_from_memory(session_id)
        raise ValueError(f"Session {session_id} not found")


def load_session_state_from_memory(session_id: str) -> TurnState:
    data = _in_memory_sessions[session_id]
    return {
        "session_id": session_id,
        "user_id": data.get("user_id", "test_user"),
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
    """Updates high-level session status and phase."""
    now_iso = datetime.now(timezone.utc).isoformat()
    if session_id in _in_memory_sessions:
        _in_memory_sessions[session_id]["current_phase"] = state.get("current_phase", "introduction")
        _in_memory_sessions[session_id]["session_complete"] = state.get("session_complete", False)
        _in_memory_sessions[session_id]["updated_at"] = now_iso

    if db_engine is None:
        return

    try:
        from sqlalchemy import text
        with db_engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE interview_sessions
                    SET current_phase = :current_phase, session_complete = :session_complete, updated_at = NOW()
                    WHERE session_id = :session_id
                """),
                {
                    "session_id": session_id,
                    "current_phase": state.get("current_phase", "introduction"),
                    "session_complete": state.get("session_complete", False),
                },
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error saving session state to Postgres: {e}")


def save_turn(state: TurnState) -> None:
    """Appends candidate turn and agent response to the session transcript array."""
    session_id = state.get("session_id")
    if not session_id:
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

    # In-memory update
    if session_id in _in_memory_sessions:
        _in_memory_sessions[session_id].setdefault("transcript_so_far", []).extend([turn_entry, action_entry])
        _in_memory_sessions[session_id]["current_phase"] = state.get("current_phase", "introduction")

    if db_engine is None:
        return

    try:
        from sqlalchemy import text
        new_entries_json = json.dumps([turn_entry, action_entry])
        with db_engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE interview_sessions
                    SET transcript_so_far = COALESCE(transcript_so_far, '[]'::jsonb) || :new_entries::jsonb,
                        current_phase = :current_phase,
                        updated_at = NOW()
                    WHERE session_id = :session_id
                """),
                {
                    "session_id": session_id,
                    "new_entries": new_entries_json,
                    "current_phase": state.get("current_phase", "introduction"),
                },
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error appending turn to Postgres: {e}")


def save_evaluation(state: TurnState, evaluation_result: dict) -> None:
    """Stores final evaluation report and marks session complete."""
    session_id = state.get("session_id")
    if not session_id:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    if session_id in _in_memory_sessions:
        _in_memory_sessions[session_id]["evaluation"] = evaluation_result
        _in_memory_sessions[session_id]["session_complete"] = True
        _in_memory_sessions[session_id]["evaluated_at"] = now_iso

    if db_engine is None:
        return

    try:
        from sqlalchemy import text
        with db_engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE interview_sessions
                    SET evaluation = :evaluation::jsonb, session_complete = TRUE, updated_at = NOW()
                    WHERE session_id = :session_id
                """),
                {
                    "session_id": session_id,
                    "evaluation": json.dumps(evaluation_result),
                },
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error saving evaluation to Postgres: {e}")


def get_analytics(user_id: str) -> Dict[str, Any]:
    """Retrieves past sessions and performance analytics for candidate dashboard."""
    raw_sessions = []

    if db_engine is not None:
        try:
            from sqlalchemy import text
            with db_engine.connect() as conn:
                rows = conn.execute(
                    text("SELECT * FROM interview_sessions WHERE user_id = :user_id ORDER BY created_at DESC"),
                    {"user_id": user_id},
                ).mappings().all()
                raw_sessions = [dict(r) for r in rows]
        except Exception as e:
            logger.error(f"Error querying sessions from Postgres: {e}")
            raw_sessions = [s for s in _in_memory_sessions.values() if s.get("user_id") == user_id]
    else:
        raw_sessions = [s for s in _in_memory_sessions.values() if s.get("user_id") == user_id]

    if not raw_sessions:
        return {
            "status": "empty",
            "total_interviews": 0,
            "total_sessions": 0,
            "average_score": 0,
            "history": [],
            "recent_improvements": [],
        }

    formatted_history = []
    total_score = 0
    scored_count = 0
    all_recommendations = []

    for s in raw_sessions:
        eval_data = s.get("evaluation") or {}
        if isinstance(eval_data, str):
            try:
                eval_data = json.loads(eval_data)
            except Exception:
                eval_data = {}

        raw_overall = eval_data.get("overall_score") or eval_data.get("score") or 0
        score_10 = round(raw_overall / 10, 1) if raw_overall > 10 else round(raw_overall, 1)
        score_100 = int(raw_overall) if raw_overall > 10 else int(raw_overall * 10)

        if raw_overall > 0:
            total_score += score_10
            scored_count += 1

        tech_raw = eval_data.get("technical_score") or (eval_data.get("technical") or {}).get("score", 0)
        comm_raw = eval_data.get("communication_score") or (eval_data.get("communication") or {}).get("score", 0)
        prob_raw = eval_data.get("problem_solving_score") or (eval_data.get("resume_fit") or {}).get("score", 0)
        pres_raw = eval_data.get("presentation_score") or (eval_data.get("presentation") or {}).get("score", 0)

        tech_10 = round(tech_raw / 10, 1) if tech_raw > 10 else round(tech_raw, 1)
        comm_10 = round(comm_raw / 10, 1) if comm_raw > 10 else round(comm_raw, 1)
        prob_10 = round(prob_raw / 10, 1) if prob_raw > 10 else round(prob_raw, 1)
        pres_10 = round(pres_raw / 10, 1) if pres_raw > 10 else round(pres_raw, 1)

        recommendations = eval_data.get("recommendations") or eval_data.get("improvements") or []
        all_recommendations.extend(recommendations)

        created_at = s.get("created_at")
        date_str = str(created_at)[:10] if created_at else "Recently"

        transcript = s.get("transcript_so_far") or []
        if isinstance(transcript, str):
            try:
                transcript = json.loads(transcript)
            except Exception:
                transcript = []

        formatted_history.append({
            "session_id": s.get("session_id", ""),
            "date": date_str,
            "role": (s.get("job_description") or "Software Engineer")[:35] + "...",
            "overall_score": score_10,
            "overall_score_100": score_100,
            "scores": {
                "technical": tech_10,
                "communication": comm_10,
                "resume": prob_10,
                "presentation": pres_10,
            },
            "feedback_text": {
                "technical": {"feedback": eval_data.get("detailed_feedback") or (eval_data.get("technical") or {}).get("feedback", "Good technical coverage.")},
                "communication": {"feedback": (eval_data.get("communication") or {}).get("feedback", "Clear responses.")},
                "resume_fit": {"feedback": (eval_data.get("resume_fit") or {}).get("feedback", "Aligned with role.")},
                "presentation": {"feedback": (eval_data.get("presentation") or {}).get("feedback", "Professional composure.")},
            },
            "transcript": transcript,
            "evaluation": eval_data,
        })

    avg_score = round(total_score / scored_count, 1) if scored_count > 0 else 0

    return {
        "status": "ok",
        "total_interviews": len(raw_sessions),
        "total_sessions": len(raw_sessions),
        "average_score": avg_score,
        "recent_improvements": list(dict.fromkeys(all_recommendations))[:5],
        "history": formatted_history,
    }


def get_user_profile(user_id: str) -> dict:
    """Retrieves candidate profile from PostgreSQL (or in-memory mock)."""
    if db_engine is not None:
        try:
            from sqlalchemy import text
            with db_engine.connect() as conn:
                row = conn.execute(
                    text("SELECT * FROM users WHERE user_id = :user_id"),
                    {"user_id": user_id},
                ).mappings().first()
                if row:
                    return dict(row)
        except Exception as e:
            logger.error(f"Error fetching profile from Postgres: {e}")

    return _in_memory_profiles.get(user_id, {
        "name": "",
        "email": "",
        "linkedin": "",
    })


def update_profile(user_id: str, profile_data: dict) -> dict:
    """Updates candidate profile in PostgreSQL (or in-memory mock)."""
    _in_memory_profiles.setdefault(user_id, {}).update(profile_data)

    if db_engine is not None:
        try:
            from sqlalchemy import text
            with db_engine.connect() as conn:
                conn.execute(
                    text("""
                        INSERT INTO users (user_id, name, email, linkedin, updated_at)
                        VALUES (:user_id, :name, :email, :linkedin, NOW())
                        ON CONFLICT (user_id) DO UPDATE
                        SET name = COALESCE(:name, users.name),
                            email = COALESCE(:email, users.email),
                            linkedin = COALESCE(:linkedin, users.linkedin),
                            updated_at = NOW()
                    """),
                    {
                        "user_id": user_id,
                        "name": profile_data.get("name", ""),
                        "email": profile_data.get("email", ""),
                        "linkedin": profile_data.get("linkedin", ""),
                    },
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Error persisting profile to Postgres: {e}")

    return profile_data
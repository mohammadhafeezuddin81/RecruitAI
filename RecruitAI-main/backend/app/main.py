import os
import tempfile
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from app.agents.orchestrator import orchestrator_graph
from app.services.database import (
    create_session,
    load_session_state,
    save_session_state,
    get_analytics,
    update_profile,
)
from app.services.ingestion import ingest_resume, ingest_job_description
from app.services.llm_config import resilient_llm  # ensures cache/tracing init on startup

app = FastAPI(
    title="RecruitAI Agent Service",
    description="Multi-agent orchestrator service for intelligent interview simulations powered by LangGraph, LangChain, and Gemini.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartInterviewRequest(BaseModel):
    userId: str
    jobDescription: str
    mode: str = "technical"


class AnswerRequest(BaseModel):
    answer: str
    silence_ms: Optional[int] = 0


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "RecruitAI Backend"}


@app.get("/")
async def root():
    return {
        "name": "RecruitAI Agent Service",
        "status": "online",
        "version": "2.0.0",
    }


@app.post("/interview/start")
async def start_interview(payload: StartInterviewRequest):
    """Initializes a new interview session and chunks the job description into vector storage."""
    try:
        session_id = create_session(
            user_id=payload.userId,
            job_description=payload.jobDescription,
            mode=payload.mode,
        )
        ingest_job_description(payload.jobDescription, session_id)
        return {
            "sessionId": session_id,
            "firstQuestion": "Hello and welcome to RecruitAI! To get started, could you please give a brief introduction of yourself and your background?",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")


@app.post("/interview/{session_id}/resume")
async def upload_resume(session_id: str, file: UploadFile = File(...)):
    """Uploads and indexes candidate resume PDF with session-filtered metadata."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        chunk_count = ingest_resume(tmp_path, user_id="candidate", session_id=session_id)
        return {
            "sessionId": session_id,
            "chunksIndexed": chunk_count,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest resume: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/interview/{session_id}/answer")
async def submit_answer(session_id: str, payload: AnswerRequest):
    """Processes candidate utterance through Observer -> Interviewer -> (on close) Evaluator LangGraph."""
    try:
        state = load_session_state(session_id)
        state["session_id"] = session_id
        state["latest_user_turn"] = payload.answer
        state["silence_duration_ms"] = payload.silence_ms or 0

        # Run master orchestrator graph
        result_state = orchestrator_graph.invoke(state)
        save_session_state(session_id, result_state)

        return {
            "phase": result_state.get("current_phase"),
            "action": result_state.get("next_action"),
            "sessionComplete": result_state.get("session_complete", False),
            "evaluation": result_state.get("evaluation"),
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Turn processing error: {str(e)}")


# --- Backward Compatibility Endpoints for Dashboard and Frontend UI ---
@app.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str):
    return get_analytics(user_id)


@app.post("/process-context")
async def process_context(
    user_id: str = Form(...),
    job_description: str = Form(...),
    file: UploadFile = File(None)
):
    session_id = create_session(user_id=user_id, job_description=job_description, mode="standard")
    ingest_job_description(job_description, session_id)
    chunks = 0
    if file and file.filename.endswith(".pdf"):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            chunks = ingest_resume(tmp_path, user_id=user_id, session_id=session_id)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    return {
        "sessionId": session_id,
        "chunksIndexed": chunks,
        "status": "ready"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
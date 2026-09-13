import os
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from app.agents.orchestrator import orchestrator_graph
from app.agents.evaluator_graph import evaluator_graph
from app.agents.state import TurnState
from app.services.database import (
    create_session,
    load_session_state,
    save_session_state,
    save_evaluation,
    get_analytics,
    get_user_profile,
    update_profile,
)
from app.services.ingestion import ingest_resume, ingest_job_description
from app.services.extractor import extract_candidate_data
from app.services.rubric_seed import seed_rubrics_if_needed
from app.services.llm_config import resilient_llm  # noqa: F401 – ensures cache/tracing init on startup


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize rubric embeddings in vector store on application startup
    try:
        seed_rubrics_if_needed()
    except Exception as e:
        print(f"Warning: Startup rubric seeding encountered: {e}")
    yield


app = FastAPI(
    title="RecruitAI Agent Service",
    description="Multi-agent orchestrator service for intelligent interview simulations powered by LangGraph, LangChain, and Gemini.",
    version="2.0.0",
    lifespan=lifespan,
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


class ChatTurnRequest(BaseModel):
    sessionId: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = []
    last_user_input: str
    job_description: Optional[str] = "Software Engineer"
    interview_strategy: Optional[str] = None


class GenerateFeedbackRequest(BaseModel):
    sessionId: Optional[str] = None
    transcript: Optional[List[Dict[str, Any]]] = []
    user_id: Optional[str] = "guest"
    job_role: Optional[str] = "Software Engineer"


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    linkedin: Optional[str] = ""


def _normalize_evaluation_output(eval_data: dict) -> dict:
    """Harmonizes 0-100 EvaluationResult with legacy /10 frontend expectations."""
    raw_overall = eval_data.get("overall_score", 75)
    overall_100 = int(raw_overall) if raw_overall > 10 else int(raw_overall * 10)
    overall_10 = round(raw_overall / 10, 1) if raw_overall > 10 else round(raw_overall, 1)

    tech_score = eval_data.get("technical_score", 75)
    comm_score = eval_data.get("communication_score", 80)
    prob_score = eval_data.get("problem_solving_score", 70)

    tech_10 = round(tech_score / 10, 1) if tech_score > 10 else round(tech_score, 1)
    comm_10 = round(comm_score / 10, 1) if comm_score > 10 else round(comm_score, 1)
    prob_10 = round(prob_score / 10, 1) if prob_score > 10 else round(prob_score, 1)

    strengths = eval_data.get("strengths", ["Solid technical fundamentals", "Structured responses"])
    weaknesses = eval_data.get("weaknesses", ["Provide deeper system trade-offs"])
    recommendations = eval_data.get("recommendations", ["Practice architectural edge-case explanations"])
    detailed_feedback = eval_data.get("detailed_feedback", "Interview completed successfully.")

    return {
        # Modern 0-100 structure
        "overall_score": overall_10,  # Legacy display format (/10)
        "overall_score_100": overall_100,  # Modern scale (/100)
        "technical_score": tech_score,
        "communication_score": comm_score,
        "problem_solving_score": prob_score,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations,
        "improvements": recommendations,  # alias for legacy UI
        "confidence_score": eval_data.get("confidence_score", 0.85),
        "detailed_feedback": detailed_feedback,
        # Legacy /10 card mappings for direct frontend compatibility
        "technical": {
            "score": tech_10,
            "score_100": tech_score,
            "feedback": detailed_feedback,
        },
        "communication": {
            "score": comm_10,
            "score_100": comm_score,
            "feedback": f"Confidence: {int(eval_data.get('confidence_score', 0.85) * 100)}%. Clear and responsive cadence.",
        },
        "resume_fit": {
            "score": prob_10,
            "score_100": prob_score,
            "feedback": strengths[0] if strengths else "Strong alignment with role demands.",
        },
        "presentation": {
            "score": overall_10,
            "score_100": overall_100,
            "feedback": strengths[1] if len(strengths) > 1 else "Poised and professional throughout.",
        },
    }


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

        evaluation = None
        if result_state.get("evaluation"):
            evaluation = _normalize_evaluation_output(result_state["evaluation"])

        return {
            "phase": result_state.get("current_phase"),
            "action": result_state.get("next_action"),
            "sessionComplete": result_state.get("session_complete", False),
            "evaluation": evaluation,
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Turn processing error: {str(e)}")


@app.post("/chat/next-turn")
async def chat_next_turn(payload: ChatTurnRequest):
    """Chat mode turn handler connected to master multi-agent orchestrator."""
    session_id = payload.sessionId
    if not session_id:
        session_id = create_session(
            user_id="chat_user",
            job_description=payload.job_description or "Software Engineer",
            mode="chat",
        )

    try:
        state = load_session_state(session_id)
        state["session_id"] = session_id
        state["latest_user_turn"] = payload.last_user_input
        if payload.job_description and not state.get("job_description"):
            state["job_description"] = payload.job_description

        # Execute multi-agent graph
        result_state = orchestrator_graph.invoke(state)
        save_session_state(session_id, result_state)

        next_action = result_state.get("next_action") or {}
        agent_reply = next_action.get("question") or "Thank you. Let's move on to the next topic."

        evaluation = None
        if result_state.get("evaluation"):
            evaluation = _normalize_evaluation_output(result_state["evaluation"])

        return {
            "response": agent_reply,
            "sessionId": session_id,
            "phase": result_state.get("current_phase"),
            "action": next_action,
            "sessionComplete": result_state.get("session_complete", False),
            "evaluation": evaluation,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing error: {str(e)}")


@app.post("/generate-feedback")
@app.post("/interview/{session_id}/feedback")
async def generate_feedback(payload: GenerateFeedbackRequest, session_id: Optional[str] = None):
    """Executes Evaluator LangGraph subgraph to generate rubric-based feedback and persist to database."""
    target_session_id = session_id or payload.sessionId
    state: TurnState = {}

    if target_session_id:
        try:
            state = load_session_state(target_session_id)
        except Exception:
            state = {}

    state["session_id"] = target_session_id or "session-feedback"
    if payload.job_role:
        state["job_description"] = payload.job_role
    if payload.transcript and len(payload.transcript) > 0:
        state["transcript_so_far"] = payload.transcript

    try:
        # Run Evaluator LangGraph
        eval_result_state = evaluator_graph.invoke(state)
        raw_evaluation = eval_result_state.get("evaluation", {})
        normalized = _normalize_evaluation_output(raw_evaluation)

        # Persist to database if session exists
        if target_session_id:
            save_evaluation(state, normalized)

        return normalized
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback generation error: {str(e)}")


# --- Dashboard & Profile Endpoints ---
@app.get("/dashboard")
async def get_dashboard_default():
    """Default dashboard endpoint when user id is not provided."""
    return get_analytics("guest")


@app.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str):
    return get_analytics(user_id)


@app.get("/profile/{user_id}")
async def get_profile(user_id: str):
    return get_user_profile(user_id)


@app.put("/profile/{user_id}")
async def update_user_profile(user_id: str, payload: ProfileUpdateRequest):
    data = payload.model_dump(exclude_unset=True)
    return update_profile(user_id, data)


@app.post("/process-context")
async def process_context(
    user_id: str = Form(...),
    job_description: str = Form(...),
    file: UploadFile = File(None)
):
    """Unified context setup: ingests resume + JD, extracts candidate profile, and starts session."""
    session_id = create_session(user_id=user_id, job_description=job_description, mode="standard")
    ingest_job_description(job_description, session_id)

    chunks = 0
    resume_text = ""
    tmp_path = None

    if file and file.filename and file.filename.lower().endswith(".pdf"):
        file_bytes = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            chunks = ingest_resume(tmp_path, user_id=user_id, session_id=session_id)
            # Extract raw text for the planning agent
            try:
                from langchain_community.document_loaders import PyPDFLoader
                loader = PyPDFLoader(tmp_path)
                docs = loader.load()
                resume_text = " ".join([d.page_content for d in docs])[:12000]
            except Exception:
                resume_text = ""
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

    # Run Planning Agent: extract candidate info + interview strategy
    extracted = await extract_candidate_data(resume_text, job_description)

    return {
        "sessionId": session_id,
        "chunksIndexed": chunks,
        "status": "ready",
        "candidate_info": extracted.get("candidate_info", {"name": "Candidate", "email": "", "phone": ""}),
        "gap_analysis": extracted.get("gap_analysis", ""),
        "interview_strategy": extracted.get("interview_strategy", ""),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
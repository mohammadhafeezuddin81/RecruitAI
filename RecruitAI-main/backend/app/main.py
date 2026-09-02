from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import io
import pypdf
import json
import re

from app.services.rag_engine import ingest_text
from app.agents.interviewer import generate_next_turn
from app.agents.observer import observe_user_state
from app.services.gemini import generate_response
from app.services.extractor import extract_candidate_data
from app.services.database import save_session, get_analytics, update_profile

app = FastAPI(title="Antriview Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "Online"}

# --- DASHBOARD ---
@app.get("/dashboard/{user_id}")
def get_dashboard(user_id: str):
    return get_analytics(user_id)

# --- CONTEXT (Now takes user_id) ---
@app.post("/process-context")
async def process_context(
    user_id: str = Form(...), 
    job_description: str = Form(...),
    file: UploadFile = File(None)
):
    resume_text = "NO_RESUME"
    if file:
        content = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(content))
        resume_text = ""
        for page in pdf_reader.pages:
            resume_text += page.extract_text() + "\n"
            
    # RAG Ingestion
    full_text = f"JOB DESCRIPTION:\n{job_description}\n\nRESUME:\n{resume_text}"
    ingest_text(full_text, metadata={"source": "upload"})
    
    # Extract Data
    data = await extract_candidate_data(resume_text, job_description)
    
    # Save Profile to DB
    if "candidate_info" in data:
        update_profile(user_id, data["candidate_info"])
        
    return data

# --- CHAT TURN ---
class ChatTurnRequest(BaseModel):
    history: List[Dict[str, str]]
    last_user_input: str
    job_description: str

@app.post("/chat/next-turn")
async def chat_next_turn(request: ChatTurnRequest):
    state = await observe_user_state(request.last_user_input)
    next_response = await generate_next_turn(request.history, request.last_user_input, request.job_description)
    return {"response": next_response, "state": state}

# --- FEEDBACK (Now takes user_id and job_role) ---
class FeedbackRequest(BaseModel):
    user_id: str
    job_role: str
    transcript: list

@app.post("/generate-feedback")
async def generate_feedback(request: FeedbackRequest):
    if not request.transcript:
        return {"overall_score": 0}

    conversation_text = "\n".join([f"{msg.get('role')}: {msg.get('content')}" for msg in request.transcript])
    
    prompt = f"""
    Act as a strict Interview Coach. Review this transcript for the role of: {request.job_role}
    TRANSCRIPT: {conversation_text}
    
    Output JSON ONLY:
    {{
        "overall_score": (int 1-10),
        "technical": {{ "score": (int), "feedback": "string" }},
        "communication": {{ "score": (int), "feedback": "string" }},
        "resume_fit": {{ "score": (int), "feedback": "string" }},
        "presentation": {{ "score": (int), "feedback": "string" }},
        "improvements": ["tip 1", "tip 2", "tip 3"]
    }}
    """
    response = await generate_response(prompt)
    
    try:
        match = re.search(r"\{.*\}", response, re.DOTALL)
        if match:
            feedback_json = json.loads(match.group(0))
            save_session(request.user_id, request.transcript, feedback_json, request.job_role)
            return feedback_json
        else:
            raise ValueError("No JSON")
    except Exception as e:
        print(f"Error: {e}")
        return {"overall_score": 0}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
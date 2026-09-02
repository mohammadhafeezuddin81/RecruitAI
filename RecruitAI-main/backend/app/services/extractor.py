import google.generativeai as genai
import os
import json
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

async def extract_candidate_data(resume_text: str, job_description: str = ""):
    """
    This is the 'Planning Agent'.
    1. Extracts PII (Name, Email, Phone).
    2. Compares Resume vs JD.
    3. Generates a 'Questioning Strategy' for the Voice Bot.
    """
    model = genai.GenerativeModel('gemini-2.0-flash-lite') # Fastest model

    prompt = f"""
    You are an expert HR Data Extraction Agent.
    
    RESUME TEXT:
    {resume_text[:15000]}
    
    JOB DESCRIPTION / ROLE:
    {job_description}
    
    Task 1: Extract Candidate Details (Name, Email, Phone).
    Task 2: Compare the Resume to the Job Description.
    Task 3: Create a 'Strategy' for the interviewer. What is missing? What should be tested?
    
    Return pure JSON (no markdown) with this structure:
    {{
        "candidate_info": {{
            "name": "string",
            "email": "string",
            "phone": "string"
        }},
        "gap_analysis": "string (What skills are missing based on JD?)",
        "interview_strategy": "string (Instructions for the interviewer on what to focus on)"
    }}
    """
    
    response = await model.generate_content_async(prompt)
    clean_json = response.text.replace("```json", "").replace("```", "").strip()
    
    try:
        return json.loads(clean_json)
    except:
        return {
            "candidate_info": {"name": "Candidate", "email": "Unknown", "phone": "Unknown"},
            "gap_analysis": "General Interview",
            "interview_strategy": "Focus on general technical skills."
        }
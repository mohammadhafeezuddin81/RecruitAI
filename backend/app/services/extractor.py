"""
Candidate Data Extraction Service for RecruitAI.
Extracts PII, performs resume-vs-JD gap analysis, and generates
an interview strategy using Gemini via the unified LangChain SDK.
"""

import json
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from app.services.llm_config import resilient_llm  # noqa: F401 — ensures API key + cache init

logger = logging.getLogger("recruitai.extractor")


async def extract_candidate_data(resume_text: str, job_description: str = "") -> dict:
    """
    Planning Agent: extracts structured candidate data from resume text.
    1. Extracts PII (Name, Email, Phone).
    2. Compares Resume vs JD to produce gap analysis.
    3. Generates a 'Questioning Strategy' for the Interviewer agent.

    Returns a dict with keys: candidate_info, gap_analysis, interview_strategy.
    Falls back to safe defaults if extraction fails.
    """
    import os
    api_key = os.environ.get("GOOGLE_API_KEY", "")

    prompt = f"""You are an expert HR Data Extraction Agent.

RESUME TEXT:
{resume_text[:12000]}

JOB DESCRIPTION / ROLE:
{job_description or "General Software Engineering position"}

Task 1: Extract Candidate Details (Name, Email, Phone).
Task 2: Compare the Resume to the Job Description — what skills or experiences are missing?
Task 3: Create a concise 'Strategy' for the interviewer. What should be tested? What gaps need probing?

Return ONLY valid JSON (no markdown fences, no commentary) with exactly this structure:
{{
    "candidate_info": {{
        "name": "string",
        "email": "string",
        "phone": "string"
    }},
    "gap_analysis": "string describing missing skills vs JD",
    "interview_strategy": "string with specific focus areas and question strategies for the interviewer"
}}"""

    try:
        extractor_llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0,
            google_api_key=api_key,
        )
        response = await extractor_llm.ainvoke([HumanMessage(content=prompt)])
        raw_text = response.content.strip()

        # Strip markdown fences if the model wraps its output anyway
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        return json.loads(raw_text)

    except json.JSONDecodeError as e:
        logger.warning(f"Extractor JSON parse error: {e}. Using safe defaults.")
    except Exception as e:
        logger.warning(f"Extractor LLM call failed: {e}. Using safe defaults.")

    # Safe fallback — app continues without resume context
    return {
        "candidate_info": {"name": "Candidate", "email": "", "phone": ""},
        "gap_analysis": "Unable to perform gap analysis. General interview mode active.",
        "interview_strategy": "Focus on core technical fundamentals, problem-solving approach, and communication clarity.",
    }
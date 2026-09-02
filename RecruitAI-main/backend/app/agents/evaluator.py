from app.services.gemini import generate_response
import json

async def evaluate_interview(transcript: list):
    """
    Generates the final JSON report.
    """
    conversation_text = "\n".join([f"{msg.get('role')}: {msg.get('content')}" for msg in transcript])
    
    prompt = f"""
    You are a Hiring Committee. Grade this interview.
    
    TRANSCRIPT:
    {conversation_text}
    
    Output JSON with:
    - overall_score (1-10)
    - technical (score, feedback)
    - communication (score, feedback)
    - resume_fit (score, feedback)
    - presentation (score, feedback)
    """
    
    response = await generate_response(prompt)
    try:
        return json.loads(response.replace("```json", "").replace("```", "").strip())
    except:
        return {"error": "Failed to parse evaluation"}
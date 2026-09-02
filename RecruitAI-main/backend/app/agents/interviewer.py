from app.services.gemini import generate_response
from app.services.rag_engine import retrieve_context

async def generate_next_turn(history: list, last_user_response: str, job_description: str):
    """
    The Core Reasoning Loop.
    1. RETRIEVE: Search Vector DB for resume details relevant to the user's last answer.
    2. REASON: Did the user answer the previous question well?
    3. ACT: Generate a follow-up question or move to a new topic.
    """
    
    # 1. RAG: Get relevant context from Vector DB
    # Example: User says "I used React", we fetch the "React project" details from the Resume.
    context_docs = retrieve_context(last_user_response)
    context_str = "\n".join(context_docs)

    # 2. SYSTEM PROMPT (The Agent's Brain)
    prompt = f"""
    You are an Expert Technical Interviewer. 
    
    JOB DESCRIPTION: {job_description}
    
    RELEVANT RESUME CONTEXT (From Vector DB):
    {context_str}
    
    CONVERSATION HISTORY:
    {history[-3:]} (Last 3 turns)
    
    USER'S LAST ANSWER: "{last_user_response}"
    
    YOUR TASK (Reasoning Step):
    1. Analyze the user's answer. Is it shallow or detailed?
    2. If shallow/vague -> Ask a specific technical FOLLOW-UP question to probe deeper.
    3. If detailed/good -> Move to the next requirement in the Job Description.
    4. Adapt to the user's tone.
    
    Output ONLY the next question to speak to the candidate. Keep it conversational.
    """

    response = await generate_response(prompt)
    return response

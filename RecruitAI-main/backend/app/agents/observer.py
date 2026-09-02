from app.services.gemini import generate_response

async def observe_user_state(transcript: str):
    """
    Analyzes the user's psychological state.
    """
    prompt = f"""
    Analyze this candidate's response: "{transcript}"
    
    Classify into one state:
    - CONFUSED (User is asking for help, hesitation, "I don't know")
    - OFF_TOPIC (User is talking about something irrelevant)
    - FOCUSED (User is answering the question)
    - SHORT (User gave a one-word answer)
    
    Return ONLY the classification word.
    """
    state = await generate_response(prompt)
    return state.strip().upper()
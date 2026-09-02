import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure the API key
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Initialize the Model
def get_gemini_model():
    # UPDATED: Using the latest 2.5 Flash Lite model
    # Note: If this specific string fails in Python, we might need 'gemini-2.0-flash-exp'
    # But let's try 2.5 first since Vapi supports it.
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    return model

async def generate_response(prompt: str):
    try:
        model = get_gemini_model()
        # Using async generation for performance
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        print(f"Model Error: {e}")
        # Fallback in case 2.5 isn't fully propagated to the Python SDK yet
        return "Error: Could not generate response. Please check model version."
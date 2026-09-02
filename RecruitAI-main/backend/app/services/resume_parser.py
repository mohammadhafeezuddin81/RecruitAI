import pypdf
import io
from app.services.gemini import generate_response

async def parse_resume(file_content: bytes):
    """
    1. Extracts raw text from PDF bytes.
    2. Sends text to Gemini to extract structured info (Name, Skills, Experience).
    """
    # 1. Extract Text using pypdf
    pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))
    raw_text = ""
    for page in pdf_reader.pages:
        raw_text += page.extract_text() + "\n"

    # 2. Ask Gemini to structure it (Smart Data Extraction)
    prompt = f"""
    You are an expert technical recruiter. Read this resume text:
    
    -----
    {raw_text[:20000]} 
    -----
    
    Extract the following details in a clean summary format:
    1. Candidate Name
    2. Key Technical Skills (Comma separated)
    3. Most Recent Job Title & Company
    4. Years of Experience (Estimate)
    
    Return the output as a clean string suitable for briefing an interviewer.
    """
    
    structured_data = await generate_response(prompt)
    return structured_data
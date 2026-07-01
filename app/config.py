import os
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    
    # Check if any key is set and not a placeholder
    HAS_API_KEY = bool(
        (GEMINI_API_KEY and "YOUR_" not in GEMINI_API_KEY and "API_KEY" not in GEMINI_API_KEY) or
        (OPENAI_API_KEY and "YOUR_" not in OPENAI_API_KEY) or
        (GROQ_API_KEY and "YOUR_" not in GROQ_API_KEY)
    )
    
    # Set default model: use Gemini 1.5 Flash or fallback
    if GEMINI_API_KEY:
        DEFAULT_MODEL = "gemini/gemini-2.0-flash-lite"
    elif OPENAI_API_KEY:
        DEFAULT_MODEL = "openai/gpt-4o-mini"
    elif GROQ_API_KEY:
        DEFAULT_MODEL = "groq/llama-3.1-8b-instant"
    else:
        DEFAULT_MODEL = "mock"
        
    PORT = int(os.getenv("PORT", 8000))
    HOST = os.getenv("HOST", "0.0.0.0")

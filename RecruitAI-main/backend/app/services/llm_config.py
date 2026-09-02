import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.globals import set_llm_cache
from langchain_community.cache import SQLiteCache

# --- 1. Caching: repeated rubric/greeting-phase calls hit cache instead of the API ---
try:
    set_llm_cache(SQLiteCache(database_path=".langchain_cache.db"))
except Exception as e:
    # Gracefully handle cache initialization if filesystem permissions or locks occur
    pass

# --- 2. Observability: LangSmith tracing for every chain/graph run ---
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "recruitai-production")
# LANGCHAIN_API_KEY is configured via environment variable

# --- 3. Reliability: retry + fallback wrapping for all agent LLM calls ---
# If GOOGLE_API_KEY is not set yet in test environment, use a placeholder to allow graph compilation
api_key = os.environ.get("GOOGLE_API_KEY", "DUMMY_KEY_FOR_INIT")

_primary_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite",
    temperature=0,
    google_api_key=api_key,
)

_fallback_llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0,
    google_api_key=api_key,
)

resilient_llm = _primary_llm.with_retry(
    stop_after_attempt=3,
    wait_exponential_jitter=True,
).with_fallbacks([_fallback_llm])

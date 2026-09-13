"""
RAG Engine for RecruitAI.
Uses PostgreSQL with pgvector (via Supabase) for session-scoped resume/job description
and role-category rubric retrieval. Provides an in-memory vector fallback when
DATABASE_URL is not configured for local dev and testing.
"""

import os
import logging
from typing import List, Optional
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings

logger = logging.getLogger("recruitai.rag_engine")

api_key = os.environ.get("GOOGLE_API_KEY", "DUMMY_KEY_FOR_INIT")
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=api_key
)

DATABASE_URL = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("SUPABASE_DB_URL")
    or os.environ.get("POSTGRES_URL")
)

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# In-memory document fallback store for tests and offline development
_in_memory_docs: List[Document] = []
_vectorstore = None

if DATABASE_URL:
    try:
        from langchain_postgres import PGVector
        _vectorstore = PGVector(
            embeddings=embeddings,
            collection_name="recruitai_documents",
            connection=DATABASE_URL,
            use_jsonb=True,
        )
        logger.info("Successfully initialized PGVector on PostgreSQL.")
    except Exception as e:
        logger.warning(f"PGVector initialization deferred or running in fallback mode: {e}")
        _vectorstore = None


class FallbackRetriever:
    """Lightweight in-memory retriever for offline dev and test suites."""

    def __init__(self, filter_dict: dict, k: int = 3):
        self.filter_dict = filter_dict
        self.k = k

    def invoke(self, query: str) -> List[Document]:
        matched = []
        for doc in _in_memory_docs:
            match = True
            for key, val in self.filter_dict.items():
                if doc.metadata.get(key) != val:
                    match = False
                    break
            if match:
                matched.append(doc)
        return matched[:self.k]


def add_documents(texts: list[str], metadatas: list[dict]):
    """Adds chunked text segments with attached metadata into PGVector (or in-memory fallback)."""
    if not texts:
        return

    # Always update in-memory cache for fast local access
    for text, meta in zip(texts, metadatas):
        _in_memory_docs.append(Document(page_content=text, metadata=meta))

    if _vectorstore is not None:
        try:
            _vectorstore.add_texts(texts=texts, metadatas=metadatas)
        except Exception as e:
            logger.error(f"Error adding texts to PGVector: {e}")


def get_resume_retriever(session_id: str, k: int = 3):
    """Filtered to only this specific session's resume/JD chunks."""
    if _vectorstore is not None:
        try:
            return _vectorstore.as_retriever(
                search_kwargs={"k": k, "filter": {"session_id": session_id}}
            )
        except Exception as e:
            logger.warning(f"Error creating PGVector resume retriever: {e}")

    return FallbackRetriever(filter_dict={"session_id": session_id}, k=k)


def get_rubric_retriever(role_category: str = "general", k: int = 4):
    """Filtered to the relevant rubric category."""
    if _vectorstore is not None:
        try:
            return _vectorstore.as_retriever(
                search_kwargs={"k": k, "filter": {"role_category": role_category}}
            )
        except Exception as e:
            logger.warning(f"Error creating PGVector rubric retriever: {e}")

    return FallbackRetriever(filter_dict={"role_category": role_category}, k=k)


def retrieve_context(query: str, session_id: str = None, k: int = 3) -> list[str]:
    """Semantic search helper for candidate context."""
    if session_id:
        retriever = get_resume_retriever(session_id, k=k)
        docs = retriever.invoke(query)
    else:
        if _vectorstore is not None:
            try:
                docs = _vectorstore.similarity_search(query, k=k)
            except Exception:
                docs = _in_memory_docs[:k]
        else:
            docs = _in_memory_docs[:k]

    return [doc.page_content for doc in docs]


def check_rubrics_seeded() -> bool:
    """Checks whether rubric documents have already been seeded."""
    # Check in-memory first
    for doc in _in_memory_docs:
        if doc.metadata.get("source") == "rubric":
            return True

    if _vectorstore is not None:
        try:
            results = _vectorstore.similarity_search("evaluation criteria", k=1)
            return len(results) > 0
        except Exception:
            return False

    return False
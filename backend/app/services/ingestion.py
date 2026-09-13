from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.services.rag_engine import add_documents

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    separators=["\n\n", "\n", ". ", " "],
)


def ingest_resume(pdf_path: str, user_id: str, session_id: str) -> int:
    """Loads a resume PDF, chunks it, and adds it to the vector store with session metadata.
    Returns the number of chunks stored."""
    loader = PyPDFLoader(pdf_path)
    raw_docs = loader.load()

    chunks = splitter.split_documents(raw_docs)
    texts = [c.page_content for c in chunks]
    metadatas = [
        {
            "user_id": user_id,
            "session_id": session_id,
            "source": "resume",
            "page": c.metadata.get("page", 0),
        }
        for c in chunks
    ]

    add_documents(texts, metadatas)
    return len(chunks)


def ingest_job_description(jd_text: str, session_id: str) -> int:
    """Chunks a plain-text job description and adds it to the vector store."""
    chunks = splitter.split_text(jd_text)
    metadatas = [{"session_id": session_id, "source": "job_description"} for _ in chunks]
    add_documents(chunks, metadatas)
    return len(chunks)


def ingest_rubric(rubric_text: str, role_category: str = "general") -> int:
    """Chunks a scoring rubric and adds it to the vector store, tagged by role
    category so the Evaluator's retriever can filter to the right rubric."""
    chunks = splitter.split_text(rubric_text)
    metadatas = [{"source": "rubric", "role_category": role_category} for _ in chunks]
    add_documents(chunks, metadatas)
    return len(chunks)

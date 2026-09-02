import os
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

api_key = os.environ.get("GOOGLE_API_KEY", "DUMMY_KEY_FOR_INIT")

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=api_key
)

_vectorstore = Chroma(
    collection_name="recruitai_documents",
    embedding_function=embeddings,
    persist_directory="./chroma_db",
)


def add_documents(texts: list[str], metadatas: list[dict]):
    """Adds chunked text segments with attached metadata into the Chroma collection."""
    if not texts:
        return
    _vectorstore.add_texts(texts=texts, metadatas=metadatas)


def get_resume_retriever(session_id: str, k: int = 3):
    """Filtered to only this specific session's resume/JD chunks."""
    return _vectorstore.as_retriever(
        search_kwargs={"k": k, "filter": {"session_id": session_id}}
    )


def get_rubric_retriever(role_category: str = "general", k: int = 4):
    """Filtered to the relevant rubric category, not the whole collection."""
    return _vectorstore.as_retriever(
        search_kwargs={"k": k, "filter": {"role_category": role_category}}
    )


def retrieve_context(query: str, session_id: str = None, k: int = 3) -> list[str]:
    """Helper method for semantic search across candidate context."""
    if session_id:
        retriever = get_resume_retriever(session_id, k=k)
        docs = retriever.invoke(query)
    else:
        docs = _vectorstore.similarity_search(query, k=k)
    return [doc.page_content for doc in docs]
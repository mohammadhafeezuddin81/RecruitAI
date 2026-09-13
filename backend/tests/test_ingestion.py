import pytest
from unittest.mock import patch, MagicMock
from app.services.ingestion import ingest_job_description, ingest_rubric, ingest_resume


@patch("app.services.ingestion.add_documents")
def test_ingest_job_description(mock_add_docs):
    jd_sample = "We are seeking a Senior Python Engineer proficient in FastAPI, LangChain, and GCP."
    chunks = ingest_job_description(jd_sample, session_id="test-session-1")
    assert chunks >= 1
    mock_add_docs.assert_called_once()
    args, kwargs = mock_add_docs.call_args
    texts, metadatas = args[0], args[1]
    assert len(texts) == chunks
    assert metadatas[0]["session_id"] == "test-session-1"
    assert metadatas[0]["source"] == "job_description"


@patch("app.services.ingestion.add_documents")
def test_ingest_rubric(mock_add_docs):
    rubric_text = "Technical Evaluation Criteria: System Design (30%), Python Mastery (40%), Communication (30%)."
    chunks = ingest_rubric(rubric_text, role_category="backend_engineer")
    assert chunks >= 1
    mock_add_docs.assert_called_once()
    args, kwargs = mock_add_docs.call_args
    texts, metadatas = args[0], args[1]
    assert metadatas[0]["source"] == "rubric"
    assert metadatas[0]["role_category"] == "backend_engineer"


@patch("app.services.ingestion.PyPDFLoader")
@patch("app.services.ingestion.add_documents")
def test_ingest_resume(mock_add_docs, mock_pdf_loader):
    mock_doc = MagicMock()
    mock_doc.page_content = "John Doe - Senior Software Engineer with 5 years experience in Python and Cloud architectures."
    mock_doc.metadata = {"page": 1}
    mock_pdf_loader.return_value.load.return_value = [mock_doc]

    chunks = ingest_resume("dummy_path.pdf", user_id="user_99", session_id="session_88")
    assert chunks >= 1
    mock_add_docs.assert_called_once()
    args, _ = mock_add_docs.call_args
    metadatas = args[1]
    assert metadatas[0]["session_id"] == "session_88"
    assert metadatas[0]["user_id"] == "user_99"
    assert metadatas[0]["source"] == "resume"

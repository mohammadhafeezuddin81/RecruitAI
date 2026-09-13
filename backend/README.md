# RecruitAI — Agent Service (Backend)

The core multi-agent cognitive service for RecruitAI, built with **Python 3.11**, **FastAPI**, **LangGraph**, and **LangChain**.

---

## Architecture

- **Observer Agent**: Analyzes pause durations (>2s), speech filler words, and candidate sentiment.
- **Interviewer Agent**: Manages the 8-Phase Finite State Machine (Introduction, Screening, Adaptation, Follow-Up, Deep Dive, Scenario, Feedback, Closing) with session-scoped RAG retrieval from ChromaDB.
- **Evaluator Agent**: Evaluates completed interviews against scoring rubrics with a confidence-gated retry loop (re-evaluates if confidence < 0.70).
- **Orchestrator**: Supervises the subgraphs and handles Firebase Firestore persistence for sessions, transcript arrays, and evaluation reports.

---

## Local Setup

### 1. Create Virtual Environment
```bash
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run FastAPI Server
```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Run Tests
```bash
pytest -v
```

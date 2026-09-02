# Antriview — Final Complete Rebuild (Master Document)

This is the single, consolidated reference for the full rebuild. It merges the
Express gateway, GCP/CI setup, the three-agent LangGraph system, Firestore
persistence, and the remaining LangChain features into one document. Nothing
else needs to be added after this — treat this as the spec to implement against.

---

## PART A — Final Architecture

```
┌──────────────────┐
│ Next.js Frontend  │  (Clerk auth, Vapi voice UI)
└─────────┬──────────┘
          │ HTTPS
          ▼
┌──────────────────────────┐
│ Node/Express Gateway       │  Cloud Run (public)
│ auth · validation · rate   │
│ limit · routes to backend  │
└─────────┬──────────────────┘
          │ internal (IAM-authed)
          ▼
┌────────────────────────────────────────────────────────┐
│ Python FastAPI — Agent Service        Cloud Run (internal)│
│                                                            │
│   ┌────────────────────────────────────────────────┐     │
│   │           Orchestrator Graph (LangGraph)         │     │
│   │                                                    │     │
│   │  ┌───────────┐  ┌───────────────┐  ┌───────────┐│     │
│   │  │ Observer   │→│ Interviewer     │→│ (on close) ││     │
│   │  │ subgraph   │  │ subgraph        │  │ Evaluator ││     │
│   │  └───────────┘  └───────────────┘  │ subgraph   ││     │
│   │                                       └───────────┘│     │
│   └────────────────────────────────────────────────┘     │
│                                                            │
│   Ingestion Pipeline (LangChain loaders + splitters)      │
│   → Chroma vector store (RAG for resume/JD/rubric)        │
│   Observability: LangSmith tracing                         │
│   Reliability: retry + fallback wrappers, LLM cache        │
└─────────┬──────────────────────────────────────────────┘
          │
          ▼
┌──────────────────┐
│ Firebase Firestore │  session state, transcripts, evaluations
└──────────────────┘
```

---

## PART B — Final Folder Structure

```
antriview/
├── gateway/                          # Node/Express API Gateway
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/{interview,health}.routes.js
│   │   ├── middleware/{auth,validate,rateLimit}.middleware.js
│   │   └── services/fastapiClient.js
│   ├── tests/interview.routes.test.js
│   ├── Dockerfile
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── schemas.py            # Pydantic structured-output models
│   │   │   ├── state.py              # LangGraph state TypedDicts
│   │   │   ├── observer_graph.py
│   │   │   ├── interviewer_graph.py
│   │   │   ├── evaluator_graph.py
│   │   │   └── orchestrator.py       # composes all three subgraphs
│   │   ├── services/
│   │   │   ├── rag_engine.py         # Chroma retrievers
│   │   │   ├── ingestion.py          # NEW — document loaders + splitters
│   │   │   ├── database.py           # NEW — Firestore persistence layer
│   │   │   ├── llm_config.py         # NEW — caching, retry, fallback, tracing setup
│   │   │   ├── gemini.py
│   │   │   └── extractor.py
│   │   └── main.py
│   ├── tests/
│   │   ├── test_orchestrator.py
│   │   ├── test_ingestion.py         # NEW
│   │   └── test_database.py          # NEW
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                         # Next.js (unchanged)
│
├── docs/
│   ├── API.md
│   └── architecture-diagram.png
│
├── .github/workflows/ci.yml
├── .gitignore
└── README.md
```

---

## PART C — Express Gateway

*(unchanged from prior doc — included here by reference for completeness)*

Files: `gateway/src/server.js`, `routes/interview.routes.js`, `routes/health.routes.js`,
`middleware/auth.middleware.js`, `middleware/validate.middleware.js`,
`middleware/rateLimit.middleware.js`, `services/fastapiClient.js`,
`tests/interview.routes.test.js`, `Dockerfile`, `package.json`.

See the earlier "Antriview → Full JD-Aligned Overhaul Guide" document for full code —
it does not change in this final pass.

---

## PART D — Shared Schemas & State

*(unchanged from the multi-agent rebuild — `schemas.py` and `state.py` as previously defined)*

---

## PART E — NEW: Document Ingestion Pipeline

This was the missing half of the RAG story — you had a retriever but no defined
way documents (resumes, job descriptions, rubrics) actually get into the vector
store. This closes that gap using LangChain document loaders and text splitters.

### `backend/app/services/ingestion.py`
```python
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.services.rag_engine import add_documents

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    separators=["\n\n", "\n", ". ", " "],
)


def ingest_resume(pdf_path: str, user_id: str, session_id: str) -> int:
    """Loads a resume PDF, chunks it, and adds it to the vector store.
    Returns the number of chunks stored."""
    loader = PyPDFLoader(pdf_path)
    raw_docs = loader.load()

    chunks = splitter.split_documents(raw_docs)
    texts = [c.page_content for c in chunks]
    metadatas = [
        {"user_id": user_id, "session_id": session_id, "source": "resume", "page": c.metadata.get("page")}
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


def ingest_rubric(rubric_text: str, role_category: str) -> int:
    """Chunks a scoring rubric and adds it to the vector store, tagged by role
    category so the Evaluator's retriever can filter to the right rubric."""
    chunks = splitter.split_text(rubric_text)
    metadatas = [{"source": "rubric", "role_category": role_category} for _ in chunks]
    add_documents(chunks, metadatas)
    return len(chunks)
```

### Why `RecursiveCharacterTextSplitter` specifically
Resumes and JDs are short, paragraph-structured documents, not long technical
manuals — `RecursiveCharacterTextSplitter` with a small chunk size (800 chars)
keeps each chunk semantically coherent (one bullet/skill/paragraph per chunk)
without needing token-aware splitting, which would be overkill here.

### `backend/app/services/rag_engine.py` (updated — filtered retrievers)
```python
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

_vectorstore = Chroma(
    collection_name="antriview_documents",
    embedding_function=embeddings,
    persist_directory="./chroma_db",
)


def add_documents(texts: list[str], metadatas: list[dict]):
    _vectorstore.add_texts(texts=texts, metadatas=metadatas)


def get_resume_retriever(session_id: str, k: int = 3):
    """Filtered to only this session's resume/JD chunks."""
    return _vectorstore.as_retriever(
        search_kwargs={"k": k, "filter": {"session_id": session_id}}
    )


def get_rubric_retriever(role_category: str = "general", k: int = 4):
    """Filtered to the relevant rubric category, not the whole collection."""
    return _vectorstore.as_retriever(
        search_kwargs={"k": k, "filter": {"role_category": role_category}}
    )
```

Metadata filtering matters here — without it, the retriever would pull chunks
from *other* candidates' resumes or unrelated rubrics, which is a real bug
worth being able to explain if asked.

---

## PART F — NEW: LLM Reliability & Observability Layer

Three more legitimate LangChain/LangSmith features, each solving a real problem
the original README already flagged (latency, production-readiness):

### `backend/app/services/llm_config.py`
```python
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.globals import set_llm_cache
from langchain_community.cache import SQLiteCache

# --- 1. Caching: repeated rubric/greeting-phase calls hit cache instead of the API ---
set_llm_cache(SQLiteCache(database_path=".langchain_cache.db"))

# --- 2. Observability: LangSmith tracing for every chain/graph run ---
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "antriview-production"
# LANGCHAIN_API_KEY set via environment, not hardcoded

# --- 3. Reliability: retry + fallback wrapping for all agent LLM calls ---
_primary_llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", temperature=0)
_fallback_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0)

resilient_llm = _primary_llm.with_retry(
    stop_after_attempt=3,
    wait_exponential_jitter=True,
).with_fallbacks([_fallback_llm])
```

Then in each agent file, swap the plain `llm` for `resilient_llm`:

```python
# observer_graph.py / interviewer_graph.py / evaluator_graph.py
from app.services.llm_config import resilient_llm as llm
```

**Why each of these, specifically:**
- **Caching (`SQLiteCache`)** — the Introduction phase asks near-identical rapport-building
  questions across sessions; caching cuts redundant Gemini calls and latency, directly
  supporting the sub-800ms goal already documented in the README's design tradeoffs.
- **LangSmith tracing** — with three agents and conditional routing, debugging *why*
  the Interviewer chose `provide_hint` over `ask_new_question` by reading logs is painful.
  LangSmith gives a visual trace of every node, input, and structured-output decision —
  this is the single most valuable addition for anyone maintaining this after you.
- **Retry + fallback** — Gemini 2.5 Flash Lite was chosen for latency, but a live voice
  interview can't just fail on one dropped API call mid-conversation. Falling back to
  a slightly slower but reliable model beats a broken session.

### `backend/requirements.txt` (final, cumulative)
```
fastapi
uvicorn
langchain
langchain-core
langchain-community
langchain-text-splitters
langgraph
langchain-google-genai
langchain-chroma
langsmith
pydantic>=2.0
firebase-admin
pypdf
```

---

## PART G — NEW: Firestore Persistence Layer

Wires the `save_turn` / `load_session_state` / `save_evaluation` calls referenced
in `orchestrator.py` and `main.py`.

### `backend/app/services/database.py`
```python
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone
from app.agents.state import TurnState

if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

SESSIONS = "interview_sessions"


def create_session(user_id: str, job_description: str, mode: str) -> str:
    doc_ref = db.collection(SESSIONS).document()
    doc_ref.set({
        "user_id": user_id,
        "job_description": job_description,
        "mode": mode,
        "current_phase": "introduction",
        "transcript_so_far": [],
        "session_complete": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    return doc_ref.id


def load_session_state(session_id: str) -> TurnState:
    doc = db.collection(SESSIONS).document(session_id).get()
    if not doc.exists:
        raise ValueError(f"Session {session_id} not found")
    data = doc.to_dict()
    return {
        "transcript_so_far": data.get("transcript_so_far", []),
        "latest_user_turn": "",
        "silence_duration_ms": 0,
        "current_phase": data.get("current_phase", "introduction"),
        "resume_context": "",
        "job_description": data.get("job_description", ""),
        "sentiment": None,
        "hesitation_detected": None,
        "recommend_hint": None,
        "next_action": None,
        "session_complete": data.get("session_complete", False),
    }


def save_session_state(session_id: str, state: TurnState) -> None:
    db.collection(SESSIONS).document(session_id).update({
        "current_phase": state["current_phase"],
        "session_complete": state["session_complete"],
        "updated_at": datetime.now(timezone.utc),
    })


def save_turn(state: TurnState) -> None:
    """Appends the latest turn + agent decision to the session's transcript array."""
    session_id = state.get("session_id")
    if not session_id:
        return  # session_id must be injected into state by main.py before invoking the graph

    turn_entry = {
        "role": "candidate",
        "content": state["latest_user_turn"],
        "sentiment": state.get("sentiment"),
        "hesitation_detected": state.get("hesitation_detected"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    action_entry = {
        "role": "interviewer",
        "content": (state.get("next_action") or {}).get("question", ""),
        "action": (state.get("next_action") or {}).get("action"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    db.collection(SESSIONS).document(session_id).update({
        "transcript_so_far": firestore.ArrayUnion([turn_entry, action_entry]),
        "current_phase": state["current_phase"],
        "updated_at": datetime.now(timezone.utc),
    })


def save_evaluation(state: TurnState, evaluation_result: dict) -> None:
    session_id = state.get("session_id")
    db.collection(SESSIONS).document(session_id).update({
        "evaluation": evaluation_result,
        "evaluated_at": datetime.now(timezone.utc),
        "session_complete": True,
    })
```

Note: `state["session_id"]` needs to be injected by `main.py` before the state is
passed into `orchestrator_graph.invoke()`, since `TurnState` itself doesn't carry
it (it's a routing/persistence concern, not agent-reasoning state) — added below.

### `backend/tests/test_database.py`
```python
import pytest
from unittest.mock import patch, MagicMock
from app.services.database import load_session_state


@patch("app.services.database.db")
def test_load_session_state_raises_on_missing_session(mock_db):
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

    with pytest.raises(ValueError):
        load_session_state("nonexistent-id")
```

---

## PART H — Final `main.py` Integration (all pieces wired together)

### `backend/app/main.py`
```python
from fastapi import FastAPI, HTTPException, UploadFile
from app.agents.orchestrator import orchestrator_graph
from app.services.database import (
    create_session, load_session_state, save_session_state,
)
from app.services.ingestion import ingest_resume, ingest_job_description
from app.services.llm_config import resilient_llm  # ensures cache/tracing init on startup
import tempfile, os

app = FastAPI(title="Antriview Agent Service")


@app.post("/interview/start")
async def start_interview(payload: dict):
    session_id = create_session(
        user_id=payload["userId"],
        job_description=payload["jobDescription"],
        mode=payload["mode"],
    )
    ingest_job_description(payload["jobDescription"], session_id)
    return {"sessionId": session_id, "firstQuestion": "Tell me a bit about yourself."}


@app.post("/interview/{session_id}/resume")
async def upload_resume(session_id: str, file: UploadFile):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        chunk_count = ingest_resume(tmp_path, user_id="unknown", session_id=session_id)
    finally:
        os.remove(tmp_path)
    return {"chunksIndexed": chunk_count}


@app.post("/interview/{session_id}/answer")
async def submit_answer(session_id: str, payload: dict):
    state = load_session_state(session_id)
    state["session_id"] = session_id  # inject for persistence layer
    state["latest_user_turn"] = payload["answer"]
    state["silence_duration_ms"] = payload.get("silence_ms", 0)

    result_state = orchestrator_graph.invoke(state)
    save_session_state(session_id, result_state)

    return {
        "phase": result_state["current_phase"],
        "action": result_state["next_action"],
        "sessionComplete": result_state["session_complete"],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## PART I — CI/CD, Testing, GCP Deployment

*(unchanged from the first overhaul document — `.github/workflows/ci.yml`,
`gateway/Dockerfile`, `backend/Dockerfile`, `gcloud run deploy` commands,
`docs/API.md` template all carry over as previously specified.)*

One addition to `ci.yml` for the new ingestion/database tests — no structural
change needed, `pytest` already picks up the new test files automatically.

One addition to Cloud Run deploy: mount `LANGCHAIN_API_KEY` and
`GOOGLE_APPLICATION_CREDENTIALS` (for `firebase-admin`) as secrets, not
plaintext env vars:

```bash
gcloud run deploy antriview-backend \
  --source ./backend \
  --region us-central1 \
  --no-allow-unauthenticated \
  --set-secrets GOOGLE_API_KEY=gemini-key:latest,LANGCHAIN_API_KEY=langsmith-key:latest \
  --set-env-vars LANGCHAIN_TRACING_V2=true,LANGCHAIN_PROJECT=antriview-production
```

---

## PART J — Complete LangChain/LangGraph Feature Inventory

Everything now present in the project, for the README's tech stack table and
for your own reference of what you can speak to:

| Feature | Where | Purpose |
|---|---|---|
| `StateGraph` / conditional edges | Observer, Interviewer, Evaluator, Orchestrator | Explicit multi-agent control flow |
| Graph-of-graphs composition | `orchestrator.py` | Real multi-agent orchestration, not a single flat graph |
| `with_structured_output(Pydantic)` | All three agents | Schema-valid decisions driving routing |
| `ChatPromptTemplate` + LCEL (`prompt \| llm`) | All three agents | Versioned, composable prompt chains |
| `Chroma` + filtered `.as_retriever()` | Interviewer, Evaluator | Session/role-scoped RAG |
| `PyPDFLoader` | `ingestion.py` | Resume document loading |
| `RecursiveCharacterTextSplitter` | `ingestion.py` | Chunking resumes/JDs/rubrics for embedding |
| `GoogleGenerativeAIEmbeddings` | `rag_engine.py` | Embedding model for the vector store |
| `.with_retry()` + `.with_fallbacks()` | `llm_config.py` | Production reliability for live voice sessions |
| `SQLiteCache` (`set_llm_cache`) | `llm_config.py` | Latency reduction on repeated calls |
| LangSmith tracing | `llm_config.py` | Observability into agent decisions |
| Deliberately **not** used: `ConversationBufferMemory`, `AgentExecutor` | — | State already tracked in LangGraph; explicit graphs preferred over autonomous loops for an FSM-driven flow |

---

## PART K — Final README Tech Stack Table

| Component | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS |
| Auth | Clerk |
| API Gateway | Node.js, Express |
| Agent Service | Python, FastAPI |
| Agent Orchestration | LangGraph (3 subgraphs + orchestrator) |
| RAG & Ingestion | LangChain (loaders, splitters, retrievers) + ChromaDB |
| LLM | Google Gemini 2.5 Flash Lite (+ 2.0 Flash fallback) |
| Reliability | LangChain retry/fallback wrappers, SQLite LLM cache |
| Observability | LangSmith tracing |
| Voice | Vapi.ai, Deepgram, 11Labs |
| Database | Firebase Firestore |
| Deployment | Google Cloud Run, Firebase Hosting |
| CI/CD | GitHub Actions |
| Testing | Jest (gateway), Pytest (backend) |

---

## PART L — Final Resume Bullets

- Designed a multi-agent AI interview platform with three LangGraph subgraphs (Observer, Interviewer, Evaluator) composed under a supervisor Orchestrator graph, driving an 8-phase adaptive interview FSM
- Built a document ingestion pipeline (LangChain loaders + text splitters) feeding a metadata-filtered ChromaDB vector store for session-scoped RAG retrieval
- Added production reliability (retry/fallback LLM wrappers, response caching) and observability (LangSmith tracing) to a live voice-driven agentic system
- Built a Node/Express API gateway (Clerk auth, validation, rate limiting) in front of an internal Python FastAPI agent service, deployed as two IAM-authenticated Cloud Run services
- Implemented CI (GitHub Actions) running Jest and Pytest suites, and wrote Firestore persistence layer for session state, transcripts, and evaluation results

---

## PART M — Final Build Checklist (nothing left after this)

- [ ] Express gateway (routes, auth, validation, rate limit, tests)
- [ ] Pydantic schemas + LangGraph state (`schemas.py`, `state.py`)
- [ ] Observer subgraph
- [ ] Interviewer subgraph (8-phase FSM via structured-output routing)
- [ ] Evaluator subgraph (confidence-gated retry)
- [ ] Orchestrator graph composing all three
- [ ] Ingestion pipeline (`PyPDFLoader`, `RecursiveCharacterTextSplitter`)
- [ ] Filtered retrievers (`rag_engine.py`, session/role-scoped)
- [ ] `llm_config.py`: caching, retry, fallback, LangSmith tracing
- [ ] Firestore layer (`database.py`: create/load/save session, save_turn, save_evaluation)
- [ ] `main.py` wiring all endpoints (start, resume upload, answer, health)
- [ ] Dockerfiles (gateway + backend)
- [ ] Cloud Run deploy (2 services, IAM-authed internal call, secrets not plaintext)
- [ ] Firebase Hosting deploy (frontend)
- [ ] GitHub Actions CI (Jest + Pytest)
- [ ] `docs/API.md`
- [ ] Architecture diagram image
- [ ] README tech stack table + resume bullets updated

Once every box above is checked and pushed, the project fully covers: Fern
stack (Firebase, Express, React, Node), GCP, LangChain, LangGraph, REST APIs,
databases, Git/CI workflow, and tested, documented code — every line item in
the JD.

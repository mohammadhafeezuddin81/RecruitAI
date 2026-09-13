# 🏛️ RecruitAI — System Architecture & Deep Dive Guide

This document provides a comprehensive technical breakdown of **RecruitAI**'s multi-agent architecture, state graph mechanics, session-scoped vector RAG pipeline, and microservices security layer.

---

## 1. 🌐 3-Tier Microservices Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Next.js 16 Frontend                            │
│  - App Router (React automatic runtime)                                 │
│  - Voice / Chat Dual Interface (Web Speech API)                         │
│  - Clerk Authentication & Modal Sign-In                                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / Bearer JWT Token
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Express.js API Gateway                           │
│  - Port 3001                                                            │
│  - Clerk authGuard & rateLimiter Middleware                             │
│  - Validation & Request Proxying                                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Internal Microservice Proxy
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      FastAPI & LangGraph AI Backend                     │
│  - Port 8000                                                            │
│  - Master Orchestrator Graph                                            │
│  - Observer Agent, Technical Interviewer Agent, Evaluator Agent          │
│  - SQLiteCache & Exponential Backoff Retry                             │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
                    ▼                                 ▼
┌──────────────────────────────────────┐    ┌──────────────────────────────┐
│       Supabase PostgreSQL            │    │     Google Gemini Engine     │
│  - `pgvector` Vector Storage         │    │  - gemini-2.5-flash-lite     │
│  - Transcripts & Evaluations         │    │  - gemini-2.0-flash (Fallback│
│  - Candidate Profiles                │    │  - text-embedding-004        │
└──────────────────────────────────────┘    └──────────────────────────────┘
```

---

## 2. 🤖 Multi-Agent LangGraph State Machine

The core intelligence is driven by **LangGraph** in [`backend/app/agents/orchestrator.py`](file:///c:/Users/moham/Downloads/RecruitAI/RecruitAI-main/backend/app/agents/orchestrator.py). Execution follows an interconnected state graph:

```
                  ┌──────────────────────┐
                  │    Observer Agent    │
                  │  (Sentiment Analysis │
                  │  & Hesitation Flag)  │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Technical Interviewer│
                  │  (8-Phase FSM + RAG) │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │ Route Condition (Phase Check)   │
            └────────┬────────────────┬───────┘
                     │                │
     Ongoing Turns   │                │ On Session Close
                     ▼                ▼
        ┌──────────────────┐    ┌──────────────────┐
        │   Persist Turn   │    │ Evaluator Agent  │
        │ (Save to Postgres│    │ (Rubric Scoring) │
        └──────────────────┘    └──────────────────┘
```

### Agents Inventory:

1. **Observer Agent** ([`observer_graph.py`](file:///c:/Users/moham/Downloads/RecruitAI/RecruitAI-main/backend/app/agents/observer_graph.py)):
   - Inspects response sentiment, hesitation duration (`silence_duration_ms`), and clarity.
   - Flags `recommend_hint=True` if candidate struggles.

2. **Technical Interviewer Agent** ([`interviewer_graph.py`](file:///c:/Users/moham/Downloads/RecruitAI/RecruitAI-main/backend/app/agents/interviewer_graph.py)):
   - Operates an 8-Phase Protocol:
     `introduction` -> `screening` -> `adaptation` -> `follow_up` -> `deep_dive` -> `scenario` -> `feedback` -> `closing`
   - Performs pgvector similarity queries (`k=3`) for target resume experience.

3. **Evaluator Agent** ([`evaluator_graph.py`](file:///c:/Users/moham/Downloads/RecruitAI/RecruitAI-main/backend/app/agents/evaluator_graph.py)):
   - Evaluates full interview transcript against stored role rubrics.
   - Scores across 4 dimensions: Technical, Communication, Problem-Solving, and Resume Fit.

---

## 3. 🎯 Session-Scoped Vector RAG Pipeline

- **PDF Ingestion**: Resume uploaded to `/process-context` is parsed using `PyPDFLoader` and split using `RecursiveCharacterTextSplitter`.
- **Embeddings**: Generated via Google Gemini `text-embedding-004`.
- **Storage**: Persisted in Supabase PostgreSQL with `pgvector` metadata-indexed by `session_id`.
- **Retrieval**: Every turn queries top $k=3$ relevant chunks to optimize prompt context token usage.

---

## 4. 🛡️ Security & Reliability Features

1. **Clerk JWT Authentication**: Every protected request must present a valid Bearer token checked against Clerk's JWKS.
2. **Rate Limiting**: IP-based rate limiting (100 requests per 15 minutes) prevents brute-force abuse and API cost spikes.
3. **Resilient LLM Fallback**: Primary model `gemini-2.5-flash-lite` retries 3 times with exponential backoff before falling back to `gemini-2.0-flash`.
4. **LLM Response Cache**: `SQLiteCache` saves redundant calls for static greeting phases.

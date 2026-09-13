# 📡 RecruitAI — Complete REST API Specification

This document details all public endpoints exposed by the **Express API Gateway** (Port 3001) and internal endpoints exposed by the **FastAPI Multi-Agent Backend** (Port 8000).

---

## 🔒 1. Authentication & Security

- **Public Traffic**: Handled by Node/Express Gateway. Protected by Clerk Bearer JWT tokens in the `Authorization` header (`Authorization: Bearer <clerk_jwt_token>`).
- **Internal Proxying**: Gateway forwards requests to FastAPI microservice with authentication guards.
- **Rate Limiting**: 100 requests per 15-minute sliding window per IP.

---

## 🌐 2. API Gateway Endpoints (`http://localhost:3001`)

### A. System Health

#### `GET /health`
- **Access**: Public
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "gateway": "RecruitAI Gateway",
  "timestamp": "2026-09-13T12:00:00.000Z"
}
```

---

### B. Context Ingestion & Candidate Analysis

#### `POST /process-context`
- **Access**: Authenticated (`Authorization: Bearer <token>`)
- **Description**: Uploads candidate resume PDF and/or job description text. Performs pgvector RAG indexing and Gemini candidate data extraction.
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `resume` *(file, optional)*: PDF resume file
  - `jobDescription` *(string, optional)*: Job description text
- **Response**: `200 OK`
```json
{
  "sessionId": "session-99a0b1",
  "chunksIndexed": 8,
  "candidateInfo": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "key_skills": ["Python", "FastAPI", "React", "PostgreSQL"],
    "experience_summary": "5 years experience in cloud native microservices",
    "gap_analysis": ["Limited hands-on Kubernetes experience"],
    "interview_strategy": "Focus deep dive on backend concurrency and system design"
  },
  "status": "success"
}
```

---

### C. Live Interview Turn Generation

#### `POST /interview/chat/next-turn`
- **Access**: Authenticated (`Authorization: Bearer <token>`)
- **Description**: Executes the LangGraph Master Orchestrator (Observer Agent -> Interviewer Agent -> Database Persistence).
- **Request Body**:
```json
{
  "sessionId": "session-99a0b1",
  "latest_user_turn": "I have extensive experience designing microservices using Python FastAPI and PostgreSQL.",
  "silence_duration_ms": 450
}
```
- **Response**: `200 OK`
```json
{
  "phase": "screening",
  "action": {
    "action": "ask_question",
    "question": "Great! Could you walk me through how you handle database connection pooling and concurrency in FastAPI?",
    "next_phase": "screening",
    "reasoning": "Candidate highlighted FastAPI and PostgreSQL; probing concurrency depth."
  },
  "sessionComplete": false,
  "evaluation": null
}
```

---

### D. Automated Feedback & Analytics

#### `POST /interview/generate-feedback`
- **Access**: Authenticated (`Authorization: Bearer <token>`)
- **Description**: Triggers the Evaluator Agent subgraph to score transcript against rubrics.
- **Request Body**:
```json
{
  "sessionId": "session-99a0b1"
}
```
- **Response**: `200 OK`
```json
{
  "sessionId": "session-99a0b1",
  "evaluation": {
    "overall_score": 88,
    "technical_score": 90,
    "communication_score": 85,
    "problem_solving_score": 89,
    "strengths": [
      "Deep understanding of async Python and connection pooling",
      "Clear, structured communication"
    ],
    "weaknesses": [
      "Could elaborate more on distributed cache invalidation strategies"
    ],
    "recommendations": [
      "Practice quantifying latency and throughput metrics under peak load"
    ],
    "detailed_feedback": "Strong performance across both technical depth and problem-solving scenarios."
  }
}
```

---

#### `GET /interview/dashboard/:userId`
- **Access**: Authenticated (`Authorization: Bearer <token>`)
- **Description**: Retrieves candidate analytics history, session transcripts, and past scores.
- **Response**: `200 OK`
```json
{
  "userId": "user-123",
  "sessions": [
    {
      "session_id": "session-99a0b1",
      "job_description": "Senior Backend Engineer",
      "overall_score": 88,
      "created_at": "2026-09-13T10:00:00Z"
    }
  ]
}
```

---

#### `GET /interview/profile/:userId` & `POST /interview/profile/:userId`
- **Access**: Authenticated (`Authorization: Bearer <token>`)
- **Description**: Fetches or updates candidate profile data and role preferences.

---

## ❌ 3. Error Standard Response

All errors return JSON with appropriate HTTP status code:

```json
{
  "error": "TooManyRequests",
  "message": "Rate limit exceeded. Please wait a few minutes before submitting more interview turns."
}
```

| HTTP Status | Meaning |
|---|---|
| `400 Bad Request` | Missing required payload parameters |
| `401 Unauthorized` | Missing or invalid Clerk Bearer token |
| `404 Not Found` | Requested session or profile does not exist |
| `429 Too Many Requests` | Rate limit threshold exceeded |
| `500 Server Error` | Unexpected backend error |

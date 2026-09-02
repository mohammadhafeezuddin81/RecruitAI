# RecruitAI — REST API Specification

This document details the public API endpoints exposed by the **Express API Gateway** (public on Cloud Run) and the internal **FastAPI Agent Service** (internal on Cloud Run).

---

## 1. Authentication & Security

- **Public Traffic**: Handled by the Node/Express Gateway. Protected by Clerk Bearer JWT tokens in the `Authorization` header (`Bearer <token>`).
- **Internal Traffic**: Gateway forwards authorized requests to the Python FastAPI backend with IAM service-to-service authentication tokens.
- **Rate Limiting**: 100 requests per 15-minute window per IP.

---

## 2. API Gateway Endpoints (`gateway/`)

### A. Health & Readiness

#### `GET /health`
- **Access**: Public (No auth required)
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "gateway": "RecruitAI Gateway",
  "timestamp": "2026-09-02T10:00:00.000Z"
}
```

#### `GET /health/ready`
- **Access**: Public
- **Description**: Verifies end-to-end connectivity to internal FastAPI backend.
- **Response**: `200 OK`
```json
{
  "status": "ready",
  "gateway": "ok",
  "backend": {
    "status": "ok",
    "service": "RecruitAI Backend"
  }
}
```

---

### B. Interview Workflow

#### `POST /interview/start`
- **Access**: Authenticated (`Authorization: Bearer <clerk_token>`)
- **Description**: Creates a new interview session and indexes the target Job Description in ChromaDB.
- **Request Body**:
```json
{
  "userId": "user_2aB3cD4eF",
  "jobDescription": "Senior Full Stack Engineer proficient in Next.js, Node.js, Python, and cloud deployments.",
  "mode": "technical"
}
```
- **Response**: `201 Created`
```json
{
  "sessionId": "x8Y9z0A1b2C3",
  "firstQuestion": "Hello and welcome to RecruitAI! To get started, could you please give a brief introduction of yourself and your background?"
}
```

---

#### `POST /interview/:sessionId/resume`
- **Access**: Authenticated (`Authorization: Bearer <clerk_token>`)
- **Description**: Ingests and chunks candidate resume PDF with session metadata for RAG retrieval.
- **Content-Type**: `multipart/form-data`
- **Form Fields**: `file` (PDF file)
- **Response**: `200 OK`
```json
{
  "sessionId": "x8Y9z0A1b2C3",
  "chunksIndexed": 6,
  "status": "success"
}
```

---

#### `POST /interview/:sessionId/answer`
- **Access**: Authenticated (`Authorization: Bearer <clerk_token>`)
- **Description**: Submits candidate's spoken or text answer turn through the LangGraph multi-agent pipeline (Observer → Interviewer → Evaluator).
- **Request Body**:
```json
{
  "answer": "In my previous project, I designed a microservices architecture using FastAPI, Docker, and Redis for caching.",
  "silence_ms": 650
}
```
- **Response**: `200 OK`
```json
{
  "phase": "deep_dive",
  "action": {
    "action": "probe_deeper",
    "question": "How did you handle cache invalidation and race conditions across your distributed FastAPI workers?",
    "next_phase": "deep_dive",
    "reasoning": "Candidate mentioned Redis caching; probing architectural depth and edge cases."
  },
  "sessionComplete": false,
  "evaluation": null
}
```

---

## 3. Evaluation & Closing Response Format

When the interview transitions to `closing` or `close_interview`, the Evaluator agent automatically runs the confidence-gated rubric assessment and attaches the final evaluation:

```json
{
  "phase": "closing",
  "action": {
    "action": "close_interview",
    "question": "Thank you for taking the time to interview today. Your complete performance analysis is now ready.",
    "next_phase": "closing",
    "reasoning": "Interview protocol complete across all 8 phases."
  },
  "sessionComplete": true,
  "evaluation": {
    "overall_score": 88,
    "technical_score": 90,
    "communication_score": 85,
    "problem_solving_score": 89,
    "strengths": [
      "Demonstrated deep understanding of distributed systems and caching strategies",
      "Articulate explanation of architectural trade-offs"
    ],
    "weaknesses": [
      "Could provide more concrete latency benchmark metrics"
    ],
    "recommendations": [
      "Practice quantifying impact and performance throughput numbers"
    ],
    "confidence_score": 0.94,
    "detailed_feedback": "Strong performance across both technical probing and scenario problem solving."
  }
}
```

---

## 4. Error Codes & Format

All error responses adhere to standard JSON error format:

```json
{
  "error": "ValidationError | Unauthorized | TooManyRequests | ServerError",
  "message": "Human readable explanation of the error",
  "details": ["Optional list of specific field validation errors"]
}
```

| Status Code | Reason |
|---|---|
| `400 Bad Request` | Missing or invalid payload fields |
| `401 Unauthorized` | Missing or expired Clerk JWT |
| `404 Not Found` | Session ID not found in Firestore |
| `429 Too Many Requests` | Rate limit threshold exceeded |
| `500 Internal Server Error` | Unhandled agent or database exception |

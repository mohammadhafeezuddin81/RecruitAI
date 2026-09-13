# 🚀 RecruitAI — Production Deployment Guide

RecruitAI is architected as a **cloud-native, high-performance platform** powered by:
- **Frontend**: [Vercel](https://vercel.com/) (Next.js)
- **API Gateway & Backend**: [Render](https://render.com/) (Express.js Gateway + FastAPI Multi-Agent Brain)
- **Database & Vector Store**: [Supabase](https://supabase.com/) (PostgreSQL + `pgvector`)

---

## 🏗️ Architecture Topology

```
┌─────────────────────────────────────────┐
│              Vercel Edge                │  (Frontend: Next.js 16)
│       recruitai-frontend.vercel.app     │
└────────────────────┬────────────────────┘
                     │ HTTPS (Clerk Bearer JWT)
                     ▼
┌─────────────────────────────────────────┐
│             Render Web Service          │  (recruitai-gateway)
│         (Node/Express API Gateway)      │  Port 3001: Auth Guard & Rate Limiter
└────────────────────┬────────────────────┘
                     │ Internal Private URL / Service-to-Service
                     ▼
┌─────────────────────────────────────────┐
│             Render Web Service          │  (recruitai-backend)
│       (FastAPI + LangGraph Orchestrator)│  Port 8000: Observer, Interviewer, Evaluator
└────────────────────┬────────────────────┘
                     │ SQL & Vector Distance Search
                     ▼
┌─────────────────────────────────────────┐
│        Supabase (Managed PostgreSQL)    │
│  ├── PostgreSQL (Sessions & Profiles)   │
│  └── pgvector (Resume & Rubric Vectors) │
└─────────────────────────────────────────┘
```

---

## 📋 Step 1: Set Up Supabase (PostgreSQL + pgvector)

1. Create a free account at [supabase.com](https://supabase.com) and create a **New Project**.
2. Go to **Project Settings** -> **Database**.
3. Under **Connection String**, select **URI** and copy the string:
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   *(or direct port 5432: `postgresql://postgres:[YOUR-PASSWORD]@db.[ref].supabase.co:5432/postgres`)*
4. Go to **SQL Editor** in Supabase and enable `pgvector` (the backend also self-provisions this automatically on boot):
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

---

## 🚀 Step 2: Deploy Backend & Gateway to Render

RecruitAI includes a 1-click Infrastructure-as-Code blueprint file: [render.yaml](file:///c:/Users/moham/Downloads/RecruitAI/RecruitAI-main/render.yaml).

1. Push your repository to GitHub.
2. Sign in to [dashboard.render.com](https://dashboard.render.com/).
3. Click **New +** -> **Blueprint**.
4. Select your **RecruitAI** GitHub repository.
5. Render will automatically detect `render.yaml` and configure two connected web services:
   - `recruitai-backend` (Docker container)
   - `recruitai-gateway` (Docker container)
6. Fill in the required environment variables:
   - `DATABASE_URL`: Your Supabase connection string from Step 1.
   - `GOOGLE_API_KEY`: Your Google Gemini API Key from [aistudio.google.com](https://aistudio.google.com).
   - `CLERK_JWT_ISSUER`: Your Clerk Issuer URL (e.g. `https://your-instance.clerk.accounts.dev`).
7. Click **Apply**.
8. Once deployed, copy your Gateway service URL:
   `https://recruitai-gateway.onrender.com`

---

## ⚡ Step 3: Deploy Frontend to Vercel

1. Sign in to [vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
2. Select your **RecruitAI** repository.
3. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
4. Add the following **Environment Variables**:

| Variable | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://recruitai-gateway.onrender.com` | Public URL of your Render Express Gateway |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk publishable key |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk secret key |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | *(optional)* | Vapi Public Key if using voice mode |
| `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | *(optional)* | Vapi Assistant ID |

5. Click **Deploy**. Your frontend is live with edge acceleration!

---

## 💻 Local Development with Docker Compose

You can spin up the exact same stack locally (including a local PostgreSQL container with `pgvector`):

1. Create a `.env` file in the repository root:
   ```env
   GOOGLE_API_KEY=AIzaSy...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_JWT_ISSUER=https://your-instance.clerk.accounts.dev
   ```
2. Start all 4 services:
   ```bash
   docker compose up --build
   ```
3. Access endpoints:
   - Frontend: `http://localhost:3000`
   - API Gateway: `http://localhost:3001`
   - Agent Backend: `http://localhost:8000`
   - PostgreSQL (pgvector): `localhost:5432`

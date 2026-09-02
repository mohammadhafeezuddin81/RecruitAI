# ☁️ RecruitAI — Cloud Deployment Guide

RecruitAI is architected as a **cloud-native, serverless multi-service platform** deployed across **Google Cloud Run** and **Firebase**.

---

## 🏗️ Deployment Topology

```
┌───────────────────────────────────────┐
│     Firebase Hosting / Vercel         │  (Frontend: Next.js 14)
└──────────────────┬────────────────────┘
                   │ HTTPS (Clerk JWT)
                   ▼
┌───────────────────────────────────────┐
│   Google Cloud Run — Public Service    │  (recruitai-gateway)
│   (Node/Express API Gateway)          │  --allow-unauthenticated
└──────────────────┬────────────────────┘
                   │ Internal VPC / IAM Service Token
                   ▼
┌───────────────────────────────────────┐
│   Google Cloud Run — Internal Service │  (recruitai-backend)
│   (Python FastAPI Agent Service)      │  --no-allow-unauthenticated
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│          Firebase Firestore           │  (Session Persistence & Transcripts)
└───────────────────────────────────────┘
```

---

## 📋 Prerequisites

1. **Google Cloud SDK (`gcloud`)** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```
2. **Enable Required GCP APIs**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     artifactregistry.googleapis.com \
     cloudbuild.googleapis.com
   ```
3. **Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

---

## 🔐 Step 1: Configure Secrets in GCP Secret Manager

Never store raw API keys in environment variables on Cloud Run. Create secrets in GCP Secret Manager:

```bash
# Gemini API Key
echo -n "YOUR_ACTUAL_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# LangSmith API Key
echo -n "YOUR_ACTUAL_LANGSMITH_KEY" | gcloud secrets create langsmith-api-key --data-file=-

# Clerk Secret Key
echo -n "YOUR_ACTUAL_CLERK_SECRET" | gcloud secrets create clerk-secret-key --data-file=-
```

---

## ⚡ Step 2: Deploy Python FastAPI Agent Service (Internal Cloud Run)

The agent service runs internally without public access. Only authorized services (like the Gateway) can invoke it.

```bash
cd backend

# Deploy to Cloud Run as an internal service
gcloud run deploy recruitai-backend \
  --source . \
  --region us-central1 \
  --no-allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-secrets GOOGLE_API_KEY=gemini-api-key:latest,LANGCHAIN_API_KEY=langsmith-api-key:latest \
  --set-env-vars LANGCHAIN_TRACING_V2=true,LANGCHAIN_PROJECT=recruitai-production
```

After deployment, copy the generated **Service URL** (e.g., `https://recruitai-backend-xyz.a.run.app`).

---

## 🛡️ Step 3: Deploy Express API Gateway (Public Cloud Run)

The gateway receives public traffic from the frontend, validates Clerk auth tokens, applies rate limits, and proxies requests to the internal backend.

```bash
cd ../gateway

# Deploy to Cloud Run as a public gateway
gcloud run deploy recruitai-gateway \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars FASTAPI_BASE_URL=https://recruitai-backend-xyz.a.run.app,CLERK_JWT_ISSUER=https://clerk.your-domain.com
```

### Grant Gateway Permission to Invoke Internal Backend:
```bash
# Get gateway default compute service account
GATEWAY_SA=$(gcloud run services describe recruitai-gateway --region us-central1 --format='value(spec.template.spec.serviceAccountName)')

# Grant Cloud Run Invoker role on the backend service
gcloud run services add-iam-policy-binding recruitai-backend \
  --region us-central1 \
  --member="serviceAccount:${GATEWAY_SA}" \
  --role="roles/run.invoker"
```

After deployment, copy the public **Gateway URL** (e.g., `https://recruitai-gateway-xyz.a.run.app`).

---

## 🎨 Step 4: Deploy Next.js Frontend

### Option A: Deploy on Vercel (Fastest & Recommended for Next.js)
1. Push your repository to GitHub.
2. Go to **[vercel.com](https://vercel.com)** → Add New Project → Select `RecruitAI` repo with Root Directory set to `frontend`.
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://recruitai-gateway-xyz.a.run.app`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = your Clerk publishable key
   - `CLERK_SECRET_KEY` = your Clerk secret key
   - `NEXT_PUBLIC_VAPI_PUBLIC_KEY` = your Vapi key
   - `NEXT_PUBLIC_VAPI_ASSISTANT_ID` = your Vapi assistant ID
4. Click **Deploy**.

---

### Option B: Deploy on Firebase Hosting
```bash
cd ../frontend

# Initialize Firebase Hosting
firebase init hosting

# Build production Next.js bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 🔄 Step 5: Automated Cloud Run Deployment via GitHub Actions (Optional CI/CD)

You can add automated deployment to `.github/workflows/deploy.yml` using Google Service Account credentials:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy Backend
        run: |
          gcloud run deploy recruitai-backend --source ./backend --region us-central1

      - name: Deploy Gateway
        run: |
          gcloud run deploy recruitai-gateway --source ./gateway --region us-central1
```

---

## 🩺 Step 6: Post-Deployment Verification

1. **Verify Gateway Health**:
   ```bash
   curl https://recruitai-gateway-xyz.a.run.app/health
   # Expected response: {"status":"ok","gateway":"RecruitAI Gateway",...}
   ```

2. **Verify End-to-End Connectivity**:
   ```bash
   curl https://recruitai-gateway-xyz.a.run.app/health/ready
   # Expected response: {"status":"ready","gateway":"ok","backend":{"status":"ok"}}
   ```

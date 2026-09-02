# 🚀 **Antriview — The Agentic AI Interview Partner**

**Submission for:** Eightfold AI Agent Building Assignment  
**Problem Statement:** Interview Practice Partner  
**Status:** Production Ready

---

## 1️⃣ **Executive Summary**

Antriview is a **multi-modal, adaptive AI platform** designed to simulate **high-pressure job interviews**.  

Unlike standard chatbots, Antriview operates as a **Goal-Driven Agentic System** with a **Voice-First architecture** and real-time **RAG (Retrieval Augmented Generation)**.  

The system follows a **structured interview protocol**, adapts its personality (**Technical** vs **HR**), and provides **brutally honest** but constructive feedback.

---

## 2️⃣ **Agentic Capabilities (🧠 The "Brain")**

To implement **Intelligent Agentic Behavior**, Antriview uses the cognitive OODA loop (**Observe, Orient, Decide, Act**) for each conversation turn.

### A. 🔄 **Finite State Machine (8-Phase Protocol)**

| Phase         | Description                                      |
|---------------|--------------------------------------------------|
| 🗣️ **Introduction** | Establish rapport, lower candidate anxiety         |
| 🧐 **Screening**    | Verify basic fit based on the Job Description      |
| 🛠️ **Adaptation**   | Switch strategy; provide hints if user struggles   |
| 📝 **Follow-Up**    | Dynamic probing based on specific answers          |
| 🔍 **Deep Dive**    | Drill into uploaded Resume skills                  |
| 🎭 **Scenario**     | Situational judgment test                          |
| 💬 **Feedback**     | Immediate, brief validation                        |
| 🎯 **Closing**      | End the session professionally                     |

---

### B. 🕸️ **Reasoning Loop (Chain-of-Thought)**

- **👀 Perception:** Observer Agent analyzes audio for hesitation/silence (>2s)
- **🔍 Retrieval:** RAG Engine fetches relevant details from ChromaDB
- **🤔 Decision:** Interviewer Agent decides next steps
- **🗣️ Execution:** Response synthesized to speech via Vapi.ai

---

### C. 🧑‍🤝‍🧑 **Multi-Agent Orchestration**

- 🕵️ **Observer Agent:** Monitors sentiment and engagement  
- 👔 **Interviewer Agent:** Manages questioning logic  
- ⚖️ **Evaluator Agent:** Performs post-interview gap analysis

---

## 3️⃣ **System Architecture**

- **🎨 Frontend:** Next.js for UI, camera, Clerk authentication, VAD visualization
- **🔊 Voice:** Vapi.ai manages audio (WebRTC), Deepgram transcription, 11Labs speech synthesis, interruption handling
- **🧠 Cognitive Layer:** Python FastAPI runs OODA agent loops, RAG, logic
- **💾 Persistence:** Firebase Firestore (profiles, history, feedback), Clerk (identity/session)

---

### 📂 Project Folder Structure

```bash
antriview/
├── backend/                     # Python FastAPI Server (The Brain)
│   ├── app/
│   │   ├── agents/              # AI Cognitive Modules
│   │   │   ├── interviewer.py   # 8-Phase Logic & Question Generation
│   │   │   ├── observer.py      # Sentiment Analysis & State Detection
│   │   │   └── evaluator.py     # Post-session Scoring & Feedback
│   │   ├── services/            # Core Services & Integrations
│   │   │   ├── rag_engine.py    # ChromaDB Vector Store & Embeddings
│   │   │   ├── database.py      # Firebase Firestore persistence
│   │   │   ├── gemini.py        # Google Gemini API Wrapper
│   │   │   └── extractor.py     # Resume PII & Skill Extraction
│   │   └── main.py              # FastAPI Entry Point & Routes
│   ├── chroma_db/               # Local Vector Database Storage
│   ├── serviceAccountKey.json   # Firebase Admin Credentials (Ignored)
│   ├── requirements.txt         # Python Dependencies
│   └── .env                     # Backend Environment Variables
│
├── frontend/                    # Next.js Client (The Interface)
│   ├── app/                     # Next.js App Router
│   │   ├── context/             # Global State (InterviewContext)
│   │   ├── dashboard/           # Analytics & History Page
│   │   ├── interview/           # Active Voice/Chat Session Page
│   │   ├── profile/             # User Profile Settings
│   │   ├── layout.tsx           # Root Layout & Clerk Provider
│   │   └── page.tsx             # Landing Page & Setup
│   ├── components/              # Reusable UI Components
│   │   └── Navbar.tsx           # Responsive Navigation
│   ├── public/                  # Static Assets
│   ├── .env.local               # Frontend Secrets (Clerk/Vapi)
│   └── package.json             # Node Dependencies
│
├── .gitignore                   # Git Ignore Rules
└── README.md                    # Documentation

```

---

## 4️⃣ **Design Decisions & Trade-Offs**

#### 1. Why a Hybrid (Next.js + Python) Stack?
- Reasoning: While Next.js API routes are powerful, serious AI engineering requires the Python ecosystem. Libraries like LangChain, PyPDF, and ChromaDB have superior support in Python.

- Decision: We separated concerns: Next.js handles the reactive view layer, while a dedicated Python FastAPI service handles the heavy computational reasoning.

#### 2. Why Gemini 2.5 Flash Lite?
- Reasoning: Voice interfaces live or die by latency. The average human pause gap is ~500ms. Standard models often average ~1.5s latency.

- Decision: We selected Gemini 2.5 Flash Lite because it offers the best reasoning-to-speed ratio, consistently hitting sub-800ms response times.

#### 3. Why Vapi.ai?
- Reasoning: Building a raw WebRTC pipeline is complex regarding Interruption Handling.

- Decision: Vapi provides out-of-the-box "barge-in" capability. If the candidate interrupts, the AI stops talking immediately. This is critical for realism.
  

| Area          | Reasoning/Trade-off                                                                         | Choice                           |
|---------------|---------------------------------------------------------------------------------------------|----------------------------------|
| **Hybrid Stack**        | Python superior for AI and RAG, JS for UI interactivity           | **Next.js + Python FastAPI**     |
| **Gemini 2.5 Flash Lite** | Sub-second response needed for voice; Gemini ~800ms avg         | **Gemini 2.5 Flash Lite (LLM)**  |
| **Vapi.ai**   | Barge-in handling, avoids WebRTC complexity                           | **Vapi.ai for speech**           |
| **Firestore** | Flexible, real-time for nested feedback                                | **Firebase Firestore**           |

---

## 5️⃣ **Tech Stack**

| 🧩 **Component**      | **Technology**               | **Purpose**                                  |
|----------------------|-----------------------------|----------------------------------------------|
| Frontend             | Next.js 14 (App Router)     | Reactive UI, camera, state management        |
| Styling              | Tailwind CSS + Lucide       | Modern, responsive design                    |
| Auth                 | Clerk                       | User/session management                      |
| Backend              | Python FastAPI              | Async API, agent orchestration               |
| Database             | Firebase Firestore          | History/analytics storage                    |
| Vector DB            | ChromaDB                    | RAG context retrieval                        |
| LLM                  | Google Gemini 2.5           | Reasoning, content generation                |
| Voice                | Vapi.ai                     | Speech-to-text/text-to-speech pipeline       |

---

## 6️⃣ **Setup Instructions**

### ⚙️ Prerequisites

- Node.js 18+
- Python 3.10+
- Google Cloud Project (Firebase)
- Vapi.ai Account (Public Key)
- Clerk Account (Publishable Keys)
- Google Gemini API Key

### 🧠 Backend Setup

cd backend

python -m venv venv

Windows: venv\Scripts\activate

Mac/Linux: source venv/bin/activate

pip install -r requirements.txt

- **Firebase:** Generate a private key, name it `serviceAccountKey.json`, place in `/backend`.
- **Environment:** Add your Gemini key to `.env` in `/backend`:
- GOOGLE_API_KEY=your_gemini_api_key_here
- **Start server:**
- python -m app.main

Runs at http://127.0.0.1:8000


### 💻 Frontend Setup

cd frontend

npm install

- **Environment:** Create `.env.local` in `/frontend`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your_vapi_assistant_id
```
- **Start app:**

npm run dev

Runs at http://localhost:3000


---

## 7️⃣ **How to Use**

1. **🔓 Sign In:**  
 Go to `http://localhost:3000`, click **Get Started**, and authenticate.

2. **🛠️ Setup Session:**  
 - Paste your job description
 - Select interview style (Technical/HR)
 - Upload resume (PDF)

3. **🎙️ Begin Interview:**  
 - Click **Begin Interview**
 - Grant microphone & camera permissions
 - Wait for agent intro and respond when "Listening..." appears  
 - *Optionally switch to Chat Mode (type answers; AI still speaks)*

4. **📈 Get Feedback:**  
 Click **End & Feedback**, wait a few seconds, and view score, transcript, and advice.

5. **📊 Analytics:**  
 Use the **Dashboard** to track progress, scores, and session history.

---
## **Tested Scenarios**

We have optimized the agent to handle specific user personas as requested:

***The Confused User***:

- Behavior: "I'm not sure about this question..."

- Agent Response: Detects hesitation via Observer Agent -> Switches to Phase 3 (Adaptation) -> Offers a scaffolded hint based on Resume context.

***The Efficient User***:

- Behavior: Gives short, precise, correct answers.

- Agent Response: Detects high competence -> Skips hints -> Immediately triggers Phase 5 (Deep Dive) to challenge the user.

***The Chatty User***:

- Behavior: Rambles off-topic.

- Agent Response: Vapi's interruption handling allows the agent to politely interject and steer the conversation back to the Job Description.
---

<img width="1433" height="1048" alt="image" src="https://github.com/user-attachments/assets/dab134d8-1a21-43a9-808d-eab916c59631" />

---

<img width="1485" height="1059" alt="image" src="https://github.com/user-attachments/assets/e83954c0-163e-4b90-919e-b36bcceac4c9" />

---

<img width="1711" height="928" alt="image" src="https://github.com/user-attachments/assets/cd66b1ee-2797-4b61-a5e7-202a7a726a1e" />

---

**✨ Interview smarter, get honest feedback, and advance your career — with Antriview! ✨**


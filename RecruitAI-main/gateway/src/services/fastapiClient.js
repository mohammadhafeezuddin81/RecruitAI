const axios = require("axios");
const FormData = require("form-data");

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000";
const SERVICE_TIMEOUT_MS = parseInt(process.env.FASTAPI_TIMEOUT_MS || "30000", 10);

const client = axios.create({
  baseURL: FASTAPI_BASE_URL,
  timeout: SERVICE_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor for attaching GCP IAM Service-to-Service Authorization header if running on Cloud Run
client.interceptors.request.use(async (config) => {
  if (process.env.GCP_SERVICE_AUTH_TOKEN) {
    config.headers.Authorization = `Bearer ${process.env.GCP_SERVICE_AUTH_TOKEN}`;
  }
  return config;
});

async function startInterview(payload) {
  const response = await client.post("/interview/start", payload);
  return response.data;
}

async function uploadResume(sessionId, fileBuffer, originalname) {
  const form = new FormData();
  form.append("file", fileBuffer, { filename: originalname || "resume.pdf" });

  const headers = form.getHeaders();
  if (process.env.GCP_SERVICE_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GCP_SERVICE_AUTH_TOKEN}`;
  }

  const response = await axios.post(
    `${FASTAPI_BASE_URL}/interview/${encodeURIComponent(sessionId)}/resume`,
    form,
    {
      headers,
      timeout: SERVICE_TIMEOUT_MS,
    }
  );
  return response.data;
}

async function processContext(userId, jobDescription, fileBuffer, originalname) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("job_description", jobDescription || "General Software Engineering");
  if (fileBuffer) {
    form.append("file", fileBuffer, { filename: originalname || "resume.pdf" });
  }

  const headers = form.getHeaders();
  if (process.env.GCP_SERVICE_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GCP_SERVICE_AUTH_TOKEN}`;
  }

  const response = await axios.post(`${FASTAPI_BASE_URL}/process-context`, form, {
    headers,
    timeout: SERVICE_TIMEOUT_MS,
  });
  return response.data;
}

async function submitAnswer(sessionId, payload) {
  const response = await client.post(`/interview/${encodeURIComponent(sessionId)}/answer`, payload);
  return response.data;
}

async function chatNextTurn(payload) {
  const response = await client.post("/chat/next-turn", payload);
  return response.data;
}

async function generateFeedback(payload, sessionId) {
  const endpoint = sessionId ? `/interview/${encodeURIComponent(sessionId)}/feedback` : "/generate-feedback";
  const response = await client.post(endpoint, payload);
  return response.data;
}

async function getDashboard(userId) {
  const endpoint = userId ? `/dashboard/${encodeURIComponent(userId)}` : "/dashboard";
  const response = await client.get(endpoint);
  return response.data;
}

async function getProfile(userId) {
  const response = await client.get(`/profile/${encodeURIComponent(userId)}`);
  return response.data;
}

async function updateProfile(userId, profileData) {
  const response = await client.put(`/profile/${encodeURIComponent(userId)}`, profileData);
  return response.data;
}

async function checkHealth() {
  const response = await client.get("/health");
  return response.data;
}

module.exports = {
  startInterview,
  uploadResume,
  processContext,
  submitAnswer,
  chatNextTurn,
  generateFeedback,
  getDashboard,
  getProfile,
  updateProfile,
  checkHealth,
  client,
};

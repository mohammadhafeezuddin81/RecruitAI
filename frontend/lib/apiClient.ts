import axios, { AxiosInstance } from "axios";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:3001";

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: GATEWAY_URL,
      timeout: 45000,
    });

    this.client.interceptors.request.use((config) => {
      // Attach Clerk Bearer token if available, else mock token for local dev
      const authToken = this.token || "mock-valid-token";
      config.headers.Authorization = `Bearer ${authToken}`;
      return config;
    });
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Submits job description and optional resume to start/prepare an interview session.
   */
  async processContext(formData: FormData) {
    const res = await this.client.post("/interview/process-context", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  }

  /**
   * Initializes session via gateway.
   */
  async startInterview(payload: { userId: string; jobDescription: string; mode?: string }) {
    const res = await this.client.post("/interview/start", payload);
    return res.data;
  }

  /**
   * Uploads candidate resume PDF for session.
   */
  async uploadResume(sessionId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await this.client.post(`/interview/${encodeURIComponent(sessionId)}/resume`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  }

  /**
   * Submits candidate utterance to LangGraph Observer -> Interviewer -> Evaluator pipeline.
   */
  async submitAnswer(sessionId: string, payload: { answer: string; silence_ms?: number }) {
    const res = await this.client.post(
      `/interview/${encodeURIComponent(sessionId)}/answer`,
      payload
    );
    return res.data;
  }

  /**
   * Chat turn execution through multi-agent orchestrator.
   */
  async chatNextTurn(payload: {
    sessionId?: string;
    history?: any[];
    last_user_input: string;
    job_description?: string;
    interview_strategy?: string;
  }) {
    const res = await this.client.post("/interview/chat/next-turn", payload);
    return res.data;
  }

  /**
   * Concludes session and returns structured rubric evaluation.
   */
  async generateFeedback(payload: {
    sessionId?: string;
    transcript?: any[];
    user_id?: string;
    job_role?: string;
  }) {
    const endpoint = payload.sessionId
      ? `/interview/${encodeURIComponent(payload.sessionId)}/feedback`
      : "/interview/generate-feedback";
    const res = await this.client.post(endpoint, payload);
    return res.data;
  }

  /**
   * Retrieves past session analytics for dashboard.
   */
  async getDashboard(userId?: string) {
    const endpoint = userId ? `/interview/dashboard/${encodeURIComponent(userId)}` : "/interview/dashboard";
    const res = await this.client.get(endpoint);
    return res.data;
  }

  /**
   * Retrieves candidate profile.
   */
  async getProfile(userId: string) {
    const res = await this.client.get(`/interview/profile/${encodeURIComponent(userId)}`);
    return res.data;
  }

  /**
   * Updates candidate profile with persistence.
   */
  async updateProfile(userId: string, data: { name?: string; email?: string; linkedin?: string }) {
    const res = await this.client.put(`/interview/profile/${encodeURIComponent(userId)}`, data);
    return res.data;
  }
}

export const apiClient = new ApiService();
export default apiClient;

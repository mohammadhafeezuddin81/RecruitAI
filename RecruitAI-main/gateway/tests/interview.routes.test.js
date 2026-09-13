const request = require("supertest");
const app = require("../src/server");
const fastapiClient = require("../src/services/fastapiClient");

jest.mock("../src/services/fastapiClient");

describe("Express Gateway — Interview Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    it("should return 200 and gateway status without requiring authentication", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.gateway).toBe("RecruitAI Gateway");
    });
  });

  describe("Authentication Guard", () => {
    it("should reject requests to /interview without Authorization header", async () => {
      const res = await request(app)
        .post("/interview/start")
        .send({ userId: "user_1", jobDescription: "Software Engineer with 5+ yrs experience" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });
  });

  describe("POST /interview/start", () => {
    it("should reject with 400 if userId or jobDescription is missing", async () => {
      const res = await request(app)
        .post("/interview/start")
        .set("Authorization", "Bearer mock-valid-token")
        .send({ userId: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("ValidationError");
    });

    it("should forward to FastAPI and return 201 on valid start payload", async () => {
      fastapiClient.startInterview.mockResolvedValue({
        sessionId: "session-12345",
        firstQuestion: "Tell me about yourself.",
      });

      const res = await request(app)
        .post("/interview/start")
        .set("Authorization", "Bearer mock-valid-token")
        .send({
          userId: "user_123",
          jobDescription: "Senior Cloud Architect responsible for GCP infrastructure.",
        });

      expect(res.status).toBe(201);
      expect(res.body.sessionId).toBe("session-12345");
      expect(fastapiClient.startInterview).toHaveBeenCalledWith({
        userId: "user_123",
        jobDescription: "Senior Cloud Architect responsible for GCP infrastructure.",
        mode: "technical",
      });
    });
  });

  describe("POST /interview/:sessionId/answer", () => {
    it("should forward turn answer to FastAPI and return next action and phase", async () => {
      fastapiClient.submitAnswer.mockResolvedValue({
        phase: "adaptation",
        action: {
          action: "provide_hint",
          question: "Think about horizontal scaling vs vertical partitioning.",
        },
        sessionComplete: false,
      });

      const res = await request(app)
        .post("/interview/session-12345/answer")
        .set("Authorization", "Bearer mock-valid-token")
        .send({
          answer: "I am not completely sure how to scale this database.",
          silence_ms: 2500,
        });

      expect(res.status).toBe(200);
      expect(res.body.phase).toBe("adaptation");
      expect(res.body.action.action).toBe("provide_hint");
      expect(fastapiClient.submitAnswer).toHaveBeenCalledWith("session-12345", {
        answer: "I am not completely sure how to scale this database.",
        silence_ms: 2500,
      });
    });
  });

  describe("POST /interview/chat/next-turn", () => {
    it("should forward chat turn to FastAPI orchestrator", async () => {
      fastapiClient.chatNextTurn.mockResolvedValue({
        response: "Could you explain your microservice design?",
        sessionId: "session-chat-1",
        phase: "screening",
      });

      const res = await request(app)
        .post("/interview/chat/next-turn")
        .set("Authorization", "Bearer mock-valid-token")
        .send({
          last_user_input: "I have built services with FastAPI and Docker.",
          job_description: "Senior Backend Developer",
        });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe("Could you explain your microservice design?");
      expect(fastapiClient.chatNextTurn).toHaveBeenCalled();
    });
  });

  describe("POST /interview/generate-feedback", () => {
    it("should trigger feedback generation and return evaluation metrics", async () => {
      fastapiClient.generateFeedback.mockResolvedValue({
        overall_score: 8.5,
        overall_score_100: 85,
        technical_score: 85,
        strengths: ["Strong systems knowledge"],
      });

      const res = await request(app)
        .post("/interview/generate-feedback")
        .set("Authorization", "Bearer mock-valid-token")
        .send({
          transcript: [{ role: "user", content: "My interview response" }],
          user_id: "user_test",
        });

      expect(res.status).toBe(200);
      expect(res.body.overall_score_100).toBe(85);
      expect(fastapiClient.generateFeedback).toHaveBeenCalled();
    });
  });

  describe("GET /interview/dashboard/:userId and /interview/profile/:userId", () => {
    it("should fetch dashboard analytics for candidate", async () => {
      fastapiClient.getDashboard.mockResolvedValue({
        total_interviews: 3,
        average_score: 8.2,
        history: [],
      });

      const res = await request(app)
        .get("/interview/dashboard/user_test")
        .set("Authorization", "Bearer mock-valid-token");

      expect(res.status).toBe(200);
      expect(res.body.total_interviews).toBe(3);
      expect(fastapiClient.getDashboard).toHaveBeenCalledWith("user_test");
    });

    it("should fetch and update candidate profile", async () => {
      fastapiClient.getProfile.mockResolvedValue({
        name: "Test User",
        email: "test@example.com",
      });
      fastapiClient.updateProfile.mockResolvedValue({
        name: "Updated Name",
        email: "test@example.com",
      });

      const getRes = await request(app)
        .get("/interview/profile/user_test")
        .set("Authorization", "Bearer mock-valid-token");

      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe("Test User");

      const putRes = await request(app)
        .put("/interview/profile/user_test")
        .set("Authorization", "Bearer mock-valid-token")
        .send({ name: "Updated Name" });

      expect(putRes.status).toBe(200);
      expect(putRes.body.name).toBe("Updated Name");
    });
  });
});

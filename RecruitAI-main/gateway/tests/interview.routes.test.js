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
});

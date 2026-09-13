const express = require("express");
const multer = require("multer");
const router = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

const {
  validateStartInterview,
  validateSubmitAnswer,
  validateResumeUpload,
} = require("../middleware/validate.middleware");
const fastapiClient = require("../services/fastapiClient");

/**
 * POST /interview/start
 * Initializes a session on the FastAPI backend
 */
router.post("/start", validateStartInterview, async (req, res, next) => {
  try {
    const { userId, jobDescription, mode } = req.body;
    const result = await fastapiClient.startInterview({
      userId,
      jobDescription,
      mode: mode || "technical",
    });
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /interview/process-context
 * Unified setup endpoint for uploading resume and parsing job description
 */
router.post("/process-context", upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.body.user_id || req.body.userId || req.user?.id || "anonymous";
    const jobDescription = req.body.job_description || req.body.jobDescription || "Software Engineer";
    const fileBuffer = req.file ? req.file.buffer : null;
    const originalname = req.file ? req.file.originalname : null;

    const result = await fastapiClient.processContext(userId, jobDescription, fileBuffer, originalname);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /interview/:sessionId/resume
 * Uploads candidate resume PDF to FastAPI backend for RAG indexing
 */
router.post(
  "/:sessionId/resume",
  upload.single("file"),
  validateResumeUpload,
  async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const result = await fastapiClient.uploadResume(
        sessionId,
        req.file.buffer,
        req.file.originalname
      );
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /interview/:sessionId/answer
 * Passes candidate answer to FastAPI multi-agent LangGraph pipeline
 */
router.post("/:sessionId/answer", validateSubmitAnswer, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { answer, silence_ms } = req.body;
    const result = await fastapiClient.submitAnswer(sessionId, {
      answer,
      silence_ms: silence_ms || 0,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /interview/chat/next-turn
 * Chat mode turn execution through multi-agent orchestrator
 */
router.post("/chat/next-turn", async (req, res, next) => {
  try {
    const result = await fastapiClient.chatNextTurn(req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /interview/:sessionId/feedback & POST /interview/generate-feedback
 * Concludes session and executes LangGraph Evaluator
 */
router.post("/:sessionId/feedback", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const result = await fastapiClient.generateFeedback(req.body, sessionId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/generate-feedback", async (req, res, next) => {
  try {
    const result = await fastapiClient.generateFeedback(req.body, req.body.sessionId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /interview/dashboard/:userId
 * Retrieves candidate past session analytics
 */
router.get("/dashboard/:userId?", async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?.id;
    const result = await fastapiClient.getDashboard(userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET & PUT /interview/profile/:userId
 * Retrieves and updates candidate profile data
 */
router.get("/profile/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await fastapiClient.getProfile(userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/profile/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await fastapiClient.updateProfile(userId, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

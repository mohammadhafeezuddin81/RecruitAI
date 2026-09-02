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

module.exports = router;

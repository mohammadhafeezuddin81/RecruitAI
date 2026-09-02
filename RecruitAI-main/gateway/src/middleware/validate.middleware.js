/**
 * Request body and parameter validation middleware
 */

function validateStartInterview(req, res, next) {
  const { userId, jobDescription } = req.body;
  const errors = [];

  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    errors.push("Field 'userId' is required and must be a non-empty string.");
  }

  if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 10) {
    errors.push("Field 'jobDescription' is required and must contain at least 10 characters.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "ValidationError",
      details: errors,
    });
  }

  next();
}

function validateSubmitAnswer(req, res, next) {
  const { answer } = req.body;
  const { sessionId } = req.params;
  const errors = [];

  if (!sessionId || typeof sessionId !== "string") {
    errors.push("Parameter 'sessionId' is required in URL.");
  }

  if (answer === undefined || typeof answer !== "string") {
    errors.push("Field 'answer' is required in body.");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "ValidationError",
      details: errors,
    });
  }

  next();
}

function validateResumeUpload(req, res, next) {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({
      error: "ValidationError",
      details: ["Parameter 'sessionId' is required in URL."],
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: "ValidationError",
      details: ["A resume file (PDF) is required under the 'file' form field."],
    });
  }

  if (req.file.mimetype !== "application/pdf" && !req.file.originalname.toLowerCase().endsWith(".pdf")) {
    return res.status(400).json({
      error: "ValidationError",
      details: ["Only PDF documents are supported for resume ingestion."],
    });
  }

  next();
}

module.exports = {
  validateStartInterview,
  validateSubmitAnswer,
  validateResumeUpload,
};

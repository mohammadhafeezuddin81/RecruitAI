require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authMiddleware = require("./middleware/auth.middleware");
const apiLimiter = require("./middleware/rateLimit.middleware");
const interviewRoutes = require("./routes/interview.routes");
const healthRoutes = require("./routes/health.routes");

const app = express();
const PORT = process.env.PORT || 3001;

// Security & Parsing
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Public Health Check
app.use("/health", healthRoutes);

// Protected Interview API with Rate Limiting & Clerk Auth
app.use("/interview", apiLimiter, authMiddleware, interviewRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Gateway Error]:", err.message || err);
  const status = err.response?.status || err.statusCode || 500;
  const message = err.response?.data?.detail || err.message || "Internal Gateway Error";
  res.status(status).json({
    error: err.name || "ServerError",
    message,
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 RecruitAI Express Gateway running on port ${PORT}`);
  });
}

module.exports = app;

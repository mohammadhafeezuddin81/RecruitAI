const express = require("express");
const router = express.Router();
const fastapiClient = require("../services/fastapiClient");

router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    gateway: "RecruitAI Gateway",
    timestamp: new Date().toISOString(),
  });
});

router.get("/ready", async (req, res) => {
  try {
    const backendHealth = await fastapiClient.checkHealth();
    res.status(200).json({
      status: "ready",
      gateway: "ok",
      backend: backendHealth,
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      gateway: "ok",
      backend: "unreachable",
      error: err.message,
    });
  }
});

module.exports = router;

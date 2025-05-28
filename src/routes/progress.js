const express = require("express");
const { catchAsync } = require("../middleware/errorHandler");
const { validateId } = require("../middleware/validation");

const router = express.Router();

// Create SSE progress session
router.get(
  "/session/:sessionId",
  validateId,
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { sessionId } = req.params;

    // Create or get existing session
    const session = progressService.createProgressSession(req, res);

    // Note: Response is handled by SSE, no JSON response needed
  })
);

// Get session information
router.get(
  "/info/:sessionId",
  validateId,
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { sessionId } = req.params;

    const sessionInfo = progressService.getSessionInfo(sessionId);

    res.json({
      success: true,
      data: sessionInfo,
      message: "Session information retrieved",
    });
  })
);

// Get all active sessions
router.get(
  "/active",
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;

    const sessions = progressService.getActiveSessions();

    res.json({
      success: true,
      data: sessions,
      message: `Found ${sessions.length} active sessions`,
    });
  })
);

// Send message to session
router.post(
  "/message/:sessionId",
  validateId,
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { sessionId } = req.params;
    const { message, type = "info" } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const sent = progressService.sendMessage(sessionId, message, type);

    res.json({
      success: sent,
      message: sent
        ? "Message sent successfully"
        : "Failed to send message (session may be inactive)",
    });
  })
);

// Update progress for session
router.post(
  "/update/:sessionId",
  validateId,
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { sessionId } = req.params;
    const { progress, message = "" } = req.body;

    if (typeof progress !== "number" || progress < 0 || progress > 100) {
      return res.status(400).json({
        success: false,
        message: "Progress must be a number between 0 and 100",
      });
    }

    const updated = progressService.updateProgress(
      sessionId,
      progress,
      message
    );

    res.json({
      success: updated,
      message: updated
        ? "Progress updated successfully"
        : "Failed to update progress (session may be inactive)",
    });
  })
);

// Update status for session
router.post(
  "/status/:sessionId",
  validateId,
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { sessionId } = req.params;
    const { status, data = {} } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const updated = progressService.updateStatus(sessionId, status, data);

    res.json({
      success: updated,
      message: updated
        ? "Status updated successfully"
        : "Failed to update status (session may be inactive)",
    });
  })
);

// Close session
router.post(
  "/close/:sessionId",
  validateId,
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { sessionId } = req.params;

    progressService.closeSession(sessionId);

    res.json({
      success: true,
      message: "Session closed successfully",
    });
  })
);

// Broadcast message to all active sessions
router.post(
  "/broadcast",
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { message, type = "info" } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const count = progressService.broadcastMessage(message, type);

    res.json({
      success: true,
      data: { sessionCount: count },
      message: `Message broadcast to ${count} active sessions`,
    });
  })
);

// Cleanup old sessions
router.post(
  "/cleanup",
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;
    const { maxAge } = req.body;

    const result = progressService.cleanupSessions(maxAge);

    res.json({
      success: true,
      data: result,
      message: `Cleaned up ${result.cleaned} old sessions`,
    });
  })
);

// Get service statistics
router.get(
  "/stats",
  catchAsync(async (req, res) => {
    const progressService = req.app.get("services").progress;

    const stats = progressService.getServiceStats();

    res.json({
      success: true,
      data: stats,
      message: "Progress service statistics retrieved",
    });
  })
);

module.exports = router;

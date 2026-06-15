const express = require("express");
const router = express.Router();

const {
  getAllAuditLogs,
  getUserActivity,
  getEntityHistory,
  getAuditSummary,
  getAuditStats,
  exportAuditLogs,
  cleanOldLogs,
} = require("../controllers/auditController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All audit routes require authentication and admin/staff access
router.use(protect);
router.use(authorize("admin", "staff"));

// Main audit endpoints
router.get("/", getAllAuditLogs);
router.get("/summary", getAuditSummary);
router.get("/stats", getAuditStats);
router.get("/export", exportAuditLogs);

// User activity
router.get("/user/:userId", getUserActivity);

// Entity history
router.get("/entity/:entityType/:entityId", getEntityHistory);

// Maintenance (admin only)
router.delete("/clean", authorize("admin"), cleanOldLogs);

module.exports = router;

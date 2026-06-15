const express = require("express");
const router = express.Router();

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  getPreferences,
  updatePreferences,
  testNotification,
} = require("../controllers/notificationController");

const { protect } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

router.get("/", getNotifications);
router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);
router.put("/:notificationId/read", markAsRead);
router.put("/read/all", markAllAsRead);
router.put("/:notificationId/dismiss", dismissNotification);
router.post("/test", testNotification);

module.exports = router;

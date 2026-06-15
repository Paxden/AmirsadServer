const express = require("express");
const router = express.Router();

const {
  sendMessage,
  getConversations,
  getConversationMessages,
  getUnreadCount,
  markAsRead,
  deleteMessage,
} = require("../controllers/messageController");

const { protect } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

router.post("/", sendMessage);
router.get("/conversations", getConversations);
router.get("/conversation/:userId", getConversationMessages);
router.get("/unread/count", getUnreadCount);
router.put("/:messageId/read", markAsRead);
router.delete("/:messageId", deleteMessage);

module.exports = router;

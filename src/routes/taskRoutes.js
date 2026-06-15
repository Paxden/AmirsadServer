const express = require("express");
const router = express.Router();

const {
  createTask,
  getMyTasks,
  getTaskById,
  updateTask,
  startTask,
  completeTask,
  addComment,
  logTime,
  getTaskStats,
  deleteTask,
} = require("../controllers/taskController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// User routes
router.get("/my", getMyTasks);
router.get("/:id", getTaskById);
router.post("/", authorize("admin", "staff"), createTask);
router.put("/:id", authorize("admin", "staff"), updateTask);
router.put("/:id/start", startTask);
router.put("/:id/complete", completeTask);
router.post("/:id/comment", addComment);
router.post("/:id/time", logTime);

// Admin routes
router.get("/admin/stats", authorize("admin", "staff"), getTaskStats);
router.delete("/:id", authorize("admin"), deleteTask);

module.exports = router;

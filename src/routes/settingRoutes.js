const express = require("express");
const router = express.Router();

const {
  getAllSettings,
  getSetting,
  updateSetting,
  bulkUpdateSettings,
  resetSetting,
} = require("../controllers/settingController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// Apply authentication and authorization to all routes
router.use(protect);
router.use(authorize("admin", "staff"));

// Routes
router.get("/", getAllSettings);
router.get("/:key", getSetting);
router.put("/:key", updateSetting);
router.post("/bulk", bulkUpdateSettings);
router.delete("/:key/reset", resetSetting);

module.exports = router;

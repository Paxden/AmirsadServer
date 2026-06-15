const express = require("express");
const router = express.Router();

const {
  createOrUpdateProfile,
  getProfile,
  submitKYC,
  reviewKYC,
  getAllBuyers,
  getBuyerStats,
} = require("../controllers/buyerController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// Buyer routes
router.post("/profile", authorize("buyer"), createOrUpdateProfile);
router.get("/profile", authorize("buyer"), getProfile);
router.post("/kyc", authorize("buyer"), submitKYC);

// Admin/Staff routes
router.get("/all", authorize("admin", "staff"), getAllBuyers);
router.get("/stats", authorize("admin", "staff"), getBuyerStats);
router.get("/profile/:userId", authorize("admin", "staff"), getProfile);
router.put("/review/:id", authorize("admin", "staff"), reviewKYC);

module.exports = router;

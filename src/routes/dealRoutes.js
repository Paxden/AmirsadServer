const express = require("express");
const router = express.Router();

const {
  createDeal,
  getAllDeals,
  getDealById,
  updateDealStatus,
  scheduleInspection,
  completeInspection,
  makeOffer,
  acceptOffer,
  recordPayment,
  scheduleDelivery,
  completeDelivery,
  closeDeal,
  cancelDeal,
  getDealStats,
  getMyDeals,
    rateDeal,
} = require("../controllers/dealController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// User routes
router.get("/my", getMyDeals);
router.get("/stats", authorize("admin", "staff"), getDealStats);
router.get("/", authorize("admin", "staff"), getAllDeals);
router.get("/:id", getDealById);

// Deal creation (admin/staff only, or automated from RFQ acceptance)
router.post("/", authorize("admin", "staff"), createDeal);

// Deal management
router.put("/:id/status", updateDealStatus);
router.put("/:id/cancel", cancelDeal);
router.put("/:id/close", closeDeal);

// Inspection flow
router.post("/:id/inspection/schedule", authorize("admin", "staff"), scheduleInspection);
router.put("/:id/inspection/complete", authorize("admin", "staff"), completeInspection);

// Negotiation flow
router.post("/:id/offer", makeOffer);
router.put("/:id/offer/accept", acceptOffer);

// Payment flow
router.post("/:id/payment", authorize("admin", "staff"), recordPayment);

// Delivery flow
router.post("/:id/delivery/schedule", authorize("admin", "staff"), scheduleDelivery);
router.put("/:id/delivery/complete", authorize("admin", "staff"), completeDelivery);

// In dealRoutes.js
router.put("/:id/rate", protect, rateDeal);

module.exports = router;

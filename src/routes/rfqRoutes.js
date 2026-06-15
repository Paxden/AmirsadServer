const express = require("express");
const router = express.Router();

const {
  createRFQ,
  getBuyerRFQs,
  getSupplierRFQs,
  getRFQById,
  staffResponse,
  acceptRFQ,
  getRFQStats,
} = require("../controllers/rfqController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// Buyer routes
router.post("/", authorize("buyer"), createRFQ);
router.get("/my-rfqs", authorize("buyer"), getBuyerRFQs);

// Supplier routes
router.get("/supplier-rfqs", authorize("supplier"), getSupplierRFQs);

// Common route
router.get("/:id", getRFQById);
router.put("/:id/accept", authorize("buyer"), acceptRFQ);

// Admin/Staff routes
router.put("/:id/respond", authorize("admin", "staff"), staffResponse);
router.get("/admin/stats", authorize("admin", "staff"), getRFQStats);

module.exports = router;

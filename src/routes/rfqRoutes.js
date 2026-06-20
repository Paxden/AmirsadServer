const express = require("express");
const router = express.Router();

const {
  createRFQ,
  getBuyerRFQs,
  getSupplierRFQs,
  getRFQById,
  staffResponse,
  acceptRFQ,
  getAllRFQs,
  getRFQStats,
  supplierRespondToRFQ,
  cancelRFQ, // Add this import
} = require("../controllers/rfqController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// Buyer routes
router.post("/", authorize("buyer"), createRFQ);
router.get("/my-rfqs", authorize("buyer"), getBuyerRFQs);
router.put("/:id/cancel", authorize("buyer"), cancelRFQ); 

// Get all RFQs (admin/staff only)
router.get("/", authorize("admin", "staff"), getAllRFQs);

// Supplier routes
router.get("/supplier-rfqs", authorize("supplier"), getSupplierRFQs);
// Add supplier response route
router.put("/:id/respond/supplier", authorize("supplier"), supplierRespondToRFQ);

// Common route
router.get("/:id", getRFQById);
router.put("/:id/accept", authorize("buyer"), acceptRFQ);

// Admin/Staff routes
router.put("/:id/respond", authorize("admin", "staff"), staffResponse);
router.get("/admin/stats", authorize("admin", "staff"), getRFQStats);

module.exports = router;
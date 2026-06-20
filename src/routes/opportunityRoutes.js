const express = require("express");
const router = express.Router();

const {
  createOpportunity,
  getMyOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  getAllOpportunities,
  approveOpportunity,
  rejectOpportunity,
  getOpportunityStats,
} = require("../controllers/opportunityController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// ==================== STATIC ROUTES FIRST ====================
// These must come BEFORE the /:id routes to avoid conflicts

// Get stats (admin/staff only)
router.get("/stats", authorize("admin", "staff"), getOpportunityStats);

// Get all opportunities (admin/staff only)
router.get("/", authorize("admin", "staff"), getAllOpportunities);

// Get my opportunities (supplier only)
router.get("/my", authorize("supplier"), getMyOpportunities);

// ==================== DYNAMIC ROUTES SECOND ====================
// These come after static routes

// Get opportunity by ID
router.get("/:id", getOpportunityById);

// Create opportunity (supplier only)
router.post("/", authorize("supplier"), createOpportunity);

// Update opportunity (supplier only)
router.put("/:id", authorize("supplier"), updateOpportunity);

// Delete opportunity (supplier only)
router.delete("/:id", authorize("supplier"), deleteOpportunity);

// Approve opportunity (admin/staff only)
router.put("/:id/approve", authorize("admin", "staff"), approveOpportunity);

// Reject opportunity (admin/staff only)
router.put("/:id/reject", authorize("admin", "staff"), rejectOpportunity);

module.exports = router;
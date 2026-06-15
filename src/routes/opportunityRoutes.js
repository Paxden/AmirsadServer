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
} = require("../controllers/opportunityController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// Supplier routes
router.post("/", authorize("supplier"), createOpportunity);
router.get("/my", authorize("supplier"), getMyOpportunities);
router.get("/my/:id", authorize("supplier"), getOpportunityById);
router.put("/my/:id", authorize("supplier"), updateOpportunity);
router.delete("/my/:id", authorize("supplier"), deleteOpportunity);

// Admin/Staff routes
router.get("/", authorize("admin", "staff"), getAllOpportunities);
router.get("/:id", authorize("admin", "staff"), getOpportunityById);
router.put("/:id/approve", authorize("admin", "staff"), approveOpportunity);
router.put("/:id/reject", authorize("admin", "staff"), rejectOpportunity);

module.exports = router;
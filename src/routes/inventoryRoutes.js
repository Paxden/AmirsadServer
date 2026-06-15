const express = require("express");
const router = express.Router();

const {
  createInventory,
  getAllInventory,
  getInventoryById,
  getSupplierInventory,
  approveInventory,
  rejectInventory,
  updateInventory,
  deleteInventory,
  getInventoryStats,
} = require("../controllers/inventoryController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// Public routes (authenticated users)
router.get("/", getAllInventory);
router.get("/stats", getInventoryStats);
router.get("/:id", getInventoryById);

// Supplier routes
router.post("/", authorize("supplier"), createInventory);

// src/routes/inventoryRoutes.js

// Get own inventory (for supplier)
router.get("/supplier/me", authorize("supplier"), getSupplierInventory);

// Get specific supplier inventory (for admin/staff)
router.get("/supplier/:supplierId", authorize("admin", "staff"), getSupplierInventory);

router.put("/:id", authorize("supplier"), updateInventory);
router.delete("/:id", authorize("supplier"), deleteInventory);

// Admin/Staff routes
router.put("/:id/approve", authorize("admin", "staff"), approveInventory);
router.put("/:id/reject", authorize("admin", "staff"), rejectInventory);

module.exports = router;
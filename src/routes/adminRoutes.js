const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  approveUser,
  rejectUser,
  suspendUser,
  activateUser,
  createStaffUser,
  deleteUser,
  getUserStats,
  getAllSuppliers, // Add this
  getAllBuyers, // Add this
  getSupplierById, // Add this
  getBuyerById,
} = require("../controllers/adminController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize("admin", "staff"));

// User management
router.get("/users", getAllUsers);
router.get("/users/stats", getUserStats);
router.get("/users/:id", getUserById);
router.put("/users/:id/approve", authorize("admin"), approveUser);
router.put("/users/:id/reject", authorize("admin"), rejectUser);
router.put("/users/:id/suspend", authorize("admin"), suspendUser);
router.put("/users/:id/activate", authorize("admin"), activateUser);
router.delete("/users/:id", authorize("admin"), deleteUser);

// Create staff (admin only)
router.post("/users/staff", authorize("admin"), createStaffUser);

// Supplier management
router.get("/suppliers", getAllSuppliers);
router.get("/suppliers/:id", getSupplierById);

// Buyer management
router.get("/buyers", getAllBuyers);
router.get("/buyers/:id", getBuyerById);

module.exports = router;

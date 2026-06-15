// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const { protect, isAdmin, restrictTo } = require("../middleware/authMiddleware");
const {
  getAllUsers,
  approveUser,
  rejectUser,
  suspendUser,
  createStaffUser,
} = require("../controllers/adminController");

// All routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// User management
router.get("/users", getAllUsers);
router.post("/users/create-staff", createStaffUser);
router.put("/users/:id/approve", approveUser);
router.put("/users/:id/reject", rejectUser);
router.put("/users/:id/suspend", suspendUser);

module.exports = router;
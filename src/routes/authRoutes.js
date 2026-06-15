const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
  refreshToken,
  logout,
  verifyEmail,
  resendVerificationEmail,
  changePassword,
  forgotPassword,
  resetPassword,
  updateProfile,
  getAllUsers,
  getUserById,
  approveUser,
  suspendUser,
  deleteUser,
  getPendingApprovals,
  getKYCSubmissions,
  getSupplierStats,
  getBuyerStats,
  getSupplierOpportunities,
  getAvailableInventory,
} = require("../controllers/authController");

const { protect, restrictTo } = require("../middleware/authMiddleware");

// ==================== PUBLIC ROUTES ====================

// Authentication
router.post("/register", register);
router.post("/login", login);

// Email verification
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

// Password management
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Token management
router.post("/refresh-token", refreshToken);

// ==================== PROTECTED ROUTES ====================
// All routes below this middleware require authentication
router.use(protect);

// User profile
router.get("/me", getMe);
router.put("/me", updateProfile);
router.post("/change-password", changePassword);
router.post("/logout", logout);

// ==================== ROLE-SPECIFIC ROUTES ====================

// Admin only routes
router.get("/users", restrictTo("admin"), getAllUsers);
router.get("/users/:userId", restrictTo("admin", "staff"), getUserById);
router.put("/users/:userId/approve", restrictTo("admin", "staff"), approveUser);
router.put("/users/:userId/suspend", restrictTo("admin"), suspendUser);
router.delete("/users/:userId", restrictTo("admin"), deleteUser);

// Staff only routes
router.get("/pending-approvals", restrictTo("admin", "staff"), getPendingApprovals);
router.get("/kyc-submissions", restrictTo("admin", "staff"), getKYCSubmissions);

// Supplier specific routes
router.get("/supplier/stats", restrictTo("supplier"), getSupplierStats);
router.get("/supplier/opportunities", restrictTo("supplier"), getSupplierOpportunities);

// Buyer specific routes
router.get("/buyer/stats", restrictTo("buyer"), getBuyerStats);
router.get("/buyer/inventory", restrictTo("buyer"), getAvailableInventory);

module.exports = router;

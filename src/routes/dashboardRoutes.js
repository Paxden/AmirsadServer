const express = require("express");
const router = express.Router();

const {
  adminDashboard,
  staffDashboard,
  supplierDashboard,
  buyerDashboard,
  getDashboardCharts,
} = require("../controllers/dashboardController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All dashboard routes require authentication
router.use(protect);

// Role-specific dashboards
router.get("/admin", authorize("admin"), adminDashboard);
router.get("/staff", authorize("admin", "staff"), staffDashboard);
router.get("/supplier", authorize("supplier"), supplierDashboard);
router.get("/buyer", authorize("buyer"), buyerDashboard);

// Charts data (for all authenticated users)
router.get("/charts", getDashboardCharts);

module.exports = router;

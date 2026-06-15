const express = require("express");
const router = express.Router();

const {
  inventoryReport,
  dealsReport,
  rfqReport,
  suppliersReport,
  exportToCSV,
} = require("../controllers/reportController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All report routes require admin/staff access
router.use(protect);
router.use(authorize("admin", "staff"));

router.get("/inventory", inventoryReport);
router.get("/deals", dealsReport);
router.get("/rfq", rfqReport);
router.get("/suppliers", suppliersReport);
router.post("/export", exportToCSV);

module.exports = router;

const express = require("express");
const router = express.Router();

const {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
  markAttendance,
  getAppointmentStats,
  getAllAppointments,
  rescheduleAppointment,
} = require("../controllers/appointmentController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// User routes
router.get("/my", getMyAppointments);
router.get("/:id", getAppointmentById);
router.post("/", authorize("admin", "staff"), createAppointment);
router.put("/:id/confirm", confirmAppointment);
router.put("/:id/cancel", cancelAppointment);
router.put("/:id/attendance", markAttendance);
router.put("/:id/reschedule", rescheduleAppointment);

// Admin/Staff routes
router.put("/:id/complete", authorize("admin", "staff"), completeAppointment);
router.get("/admin/stats", authorize("admin", "staff"), getAppointmentStats);
// Get all appointments (admin/staff only)
router.get("/", authorize("admin", "staff"), getAllAppointments);

module.exports = router;

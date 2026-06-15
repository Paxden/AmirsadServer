const Appointment = require("../models/Appointment");
const RFQ = require("../models/RFQ");
const Inventory = require("../models/Inventory");
const User = require("../models/User");

/**
 * Create new appointment
 */
exports.createAppointment = async (req, res) => {
  try {
    const {
      title,
      type,
      rfqId,
      inventoryId,
      supplierId,
      buyerId,
      scheduledDate,
      startTime,
      endTime,
      location,
      locationType,
      meetingLink,
      notes,
      agenda,
      participants,
    } = req.body;

    // Validate required fields
    if (!title || !type || !scheduledDate || !startTime || !endTime || !location) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate dates
    const appointmentDate = new Date(scheduledDate);
    if (appointmentDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot schedule appointment in the past",
      });
    }

    // Check for scheduling conflicts
    const conflictingAppointment = await Appointment.findOne({
      $or: [
        { supplier: supplierId, scheduledDate: appointmentDate, status: { $in: ["pending", "confirmed"] } },
        { buyer: buyerId, scheduledDate: appointmentDate, status: { $in: ["pending", "confirmed"] } },
      ],
      isActive: true,
    });

    if (conflictingAppointment) {
      return res.status(409).json({
        success: false,
        message: "Scheduling conflict detected. Participant already has an appointment at this time.",
      });
    }

    const appointment = await Appointment.create({
      title,
      type,
      rfq: rfqId,
      inventory: inventoryId,
      supplier: supplierId,
      buyer: buyerId,
      scheduledDate: appointmentDate,
      startTime,
      endTime,
      location,
      locationType,
      meetingLink,
      notes,
      agenda,
      participants: participants || [],
      createdBy: req.user.id,
      status: "pending",
    });

    // Update RFQ with appointment info if provided
    if (rfqId) {
      await RFQ.findByIdAndUpdate(rfqId, {
        appointmentScheduled: true,
        "appointment.date": appointmentDate,
        "appointment.location": location,
        "appointment.status": "scheduled",
      });
    }

    res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      appointment,
    });
  } catch (error) {
    console.error("Create appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create appointment",
      error: error.message,
    });
  }
};

/**
 * Get appointments for user
 */
exports.getMyAppointments = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10, upcoming } = req.query;
    
    const query = {
      isActive: true,
      $or: [
        { supplier: req.user.id },
        { buyer: req.user.id },
        { "participants.user": req.user.id },
      ],
    };

    if (status) query.status = status;
    if (type) query.type = type;
    
    if (upcoming === "true") {
      query.scheduledDate = { $gte: new Date() };
      query.status = { $in: ["confirmed", "pending"] };
    }

    const appointments = await Appointment.find(query)
      .populate("supplier", "fullName email phone profile")
      .populate("buyer", "fullName email phone profile")
      .populate("rfq", "rfqNumber requestedWeightKg offeredPricePerKg")
      .populate("inventory", "inventoryNumber weightKg purity")
      .populate("participants.user", "fullName email role")
      .sort({ scheduledDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      appointments,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get my appointments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
    });
  }
};

/**
 * Get appointment by ID
 */
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate("supplier", "fullName email phone profile")
      .populate("buyer", "fullName email phone profile")
      .populate("rfq")
      .populate("inventory")
      .populate("participants.user", "fullName email role")
      .populate("confirmedBy", "fullName email")
      .populate("createdBy", "fullName email")
      .populate("rescheduleHistory.requestedBy", "fullName email")
      .populate("rescheduleHistory.approvedBy", "fullName email");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Check authorization
    const isAuthorized =
      req.user.role === "admin" ||
      req.user.role === "staff" ||
      appointment.supplier._id.toString() === req.user.id ||
      appointment.buyer._id.toString() === req.user.id ||
      appointment.participants.some(p => p.user._id.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      appointment,
    });
  } catch (error) {
    console.error("Get appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointment",
    });
  }
};

/**
 * Confirm appointment
 */
exports.confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    await appointment.confirm(req.user.id, req.user.role);

    res.status(200).json({
      success: true,
      message: "Appointment confirmed successfully",
      appointment,
    });
  } catch (error) {
    console.error("Confirm appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm appointment",
    });
  }
};

/**
 * Cancel appointment
 */
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    await appointment.cancel(reason || "No reason provided", req.user.id);

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
    });
  }
};

/**
 * Complete appointment
 */
exports.completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, outcome, outcomeNotes, followUpRequired, followUpDate } = req.body;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    appointment.status = "completed";
    appointment.outcome = outcome || "successful";
    appointment.outcomeNotes = outcomeNotes;
    appointment.followUpRequired = followUpRequired || false;
    appointment.followUpDate = followUpDate;
    appointment.notes = notes || appointment.notes;
    appointment.updatedBy = req.user.id;
    
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment marked as completed",
      appointment,
    });
  } catch (error) {
    console.error("Complete appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete appointment",
    });
  }
};

/**
 * Mark attendance
 */
exports.markAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { attended } = req.body;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    let role = null;
    if (appointment.supplier.toString() === req.user.id) {
      role = "supplier";
    } else if (appointment.buyer.toString() === req.user.id) {
      role = "buyer";
    } else if (req.user.role === "admin" || req.user.role === "staff") {
      role = "staff";
    }

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant of this appointment",
      });
    }

    await appointment.markAttendance(req.user.id, role, attended);

    res.status(200).json({
      success: true,
      message: `Attendance marked as ${attended ? "present" : "absent"}`,
    });
  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark attendance",
    });
  }
};

/**
 * Get appointment statistics
 */
exports.getAppointmentStats = async (req, res) => {
  try {
    const stats = await Appointment.getAppointmentStats();
    const upcoming = await Appointment.getUpcomingAppointments(7);
    const today = await Appointment.getTodayAppointments();

    res.status(200).json({
      success: true,
      stats,
      upcomingCount: upcoming.length,
      todayCount: today.length,
      upcomingAppointments: upcoming.slice(0, 5),
      todayAppointments: today,
    });
  } catch (error) {
    console.error("Get appointment stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};

/**
 * Reschedule appointment
 */
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, reason } = req.body;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Add to reschedule history
    appointment.rescheduleHistory.push({
      previousDate: appointment.scheduledDate,
      newDate: new Date(newDate),
      reason,
      requestedBy: req.user.id,
      status: "pending",
    });

    appointment.status = "pending";
    appointment.scheduledDate = new Date(newDate);
    appointment.updatedBy = req.user.id;
    
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Reschedule request submitted. Waiting for approval.",
      appointment,
    });
  } catch (error) {
    console.error("Reschedule appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reschedule appointment",
    });
  }
};
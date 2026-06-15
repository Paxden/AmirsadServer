const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    // Tracking
    appointmentNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "inspection",
        "negotiation",
        "meeting",
        "closing",
        "documentation",
      ],
      required: true,
      index: true,
    },

    // Related entities
    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      index: true,
    },

    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      index: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Scheduling
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    duration: {
      type: Number, // in minutes
      default: 60,
    },

    timezone: {
      type: String,
      default: "UTC",
    },

    // Location
    location: {
      type: String,
      required: true,
    },

    locationType: {
      type: String,
      enum: ["physical", "virtual", "hybrid"],
      default: "physical",
    },

    meetingLink: {
      type: String,
      default: "",
    },

    coordinates: {
      latitude: Number,
      longitude: Number,
    },

    // Status Management
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "rescheduled",
        "no_show",
      ],
      default: "pending",
      index: true,
    },

    // Attendance Tracking
    supplierAttended: {
      type: Boolean,
      default: false,
    },

    buyerAttended: {
      type: Boolean,
      default: false,
    },

    staffAttended: {
      type: Boolean,
      default: false,
    },

    // Participants
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["supplier", "buyer", "staff", "admin", "guest"],
        },
        email: String,
        name: String,
        attended: {
          type: Boolean,
          default: false,
        },
        joinedAt: Date,
        leftAt: Date,
      },
    ],

    // Reminders
    reminders: [
      {
        type: {
          type: String,
          enum: ["email", "sms", "push"],
        },
        scheduledFor: Date,
        sentAt: Date,
        status: {
          type: String,
          enum: ["pending", "sent", "failed"],
          default: "pending",
        },
      },
    ],

    // Communication
    notes: {
      type: String,
      default: "",
    },

    agenda: {
      type: String,
      default: "",
    },

    discussionPoints: [
      {
        point: String,
        resolved: {
          type: Boolean,
          default: false,
        },
        resolution: String,
      },
    ],

    outcome: {
      type: String,
      enum: [
        "pending",
        "successful",
        "failed",
        "partially_successful",
        "rescheduled",
      ],
      default: "pending",
    },

    outcomeNotes: {
      type: String,
      default: "",
    },

    followUpRequired: {
      type: Boolean,
      default: false,
    },

    followUpDate: Date,

    followUpNotes: String,

    // Documents and Attachments
    attachments: [
      {
        name: String,
        url: String,
        type: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: Date,
      },
    ],

    // Approval Workflow
    confirmationRequired: {
      type: Boolean,
      default: true,
    },

    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    confirmedAt: Date,

    supplierConfirmed: {
      type: Boolean,
      default: false,
    },

    buyerConfirmed: {
      type: Boolean,
      default: false,
    },

    // Rescheduling History
    rescheduleHistory: [
      {
        previousDate: Date,
        newDate: Date,
        reason: String,
        requestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Cancellation
    cancellationReason: {
      type: String,
      default: "",
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledAt: Date,

    // Rating and Feedback
    supplierRating: {
      type: Number,
      min: 1,
      max: 5,
    },

    buyerRating: {
      type: Number,
      min: 1,
      max: 5,
    },

    supplierFeedback: String,
    buyerFeedback: String,

    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Soft Delete
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
// appointmentSchema.index({ appointmentNumber: 1 });
appointmentSchema.index({ supplier: 1, status: 1, scheduledDate: 1 });
appointmentSchema.index({ buyer: 1, status: 1, scheduledDate: 1 });
appointmentSchema.index({ scheduledDate: 1, status: 1 });
appointmentSchema.index({ createdAt: -1 });

// Virtuals
appointmentSchema.virtual("isUpcoming").get(function () {
  return this.scheduledDate > new Date() && this.status === "confirmed";
});

appointmentSchema.virtual("isPast").get(function () {
  return this.scheduledDate < new Date() && this.status !== "cancelled";
});

appointmentSchema.virtual("formattedDateTime").get(function () {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: this.timezone,
  }).format(this.scheduledDate);
});

appointmentSchema.virtual("durationHours").get(function () {
  return (this.duration / 60).toFixed(1);
});

// Pre-save Middleware
appointmentSchema.pre("save", async function (next) {
  // Generate appointment number if not exists
  if (!this.appointmentNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const count = await mongoose.model("Appointment").countDocuments();
    const sequence = String(count + 1).padStart(6, "0");
    this.appointmentNumber = `APT-${year}${month}-${sequence}`;
  }

  // Calculate duration from start and end times
  if (this.startTime && this.endTime) {
    const [startHour, startMinute] = this.startTime.split(":");
    const [endHour, endMinute] = this.endTime.split(":");
    const startMinutes = parseInt(startHour) * 60 + parseInt(startMinute);
    const endMinutes = parseInt(endHour) * 60 + parseInt(endMinute);
    this.duration = endMinutes - startMinutes;
  }

  next();
});

// Methods
appointmentSchema.methods.confirm = async function (userId, userRole) {
  if (userRole === "supplier") {
    this.supplierConfirmed = true;
  } else if (userRole === "buyer") {
    this.buyerConfirmed = true;
  } else {
    this.confirmedBy = userId;
    this.confirmedAt = new Date();
  }

  // Auto-confirm when both parties confirm
  if (
    !this.confirmationRequired ||
    (this.supplierConfirmed && this.buyerConfirmed) ||
    (this.confirmedBy && this.supplierConfirmed) ||
    (this.confirmedBy && this.buyerConfirmed)
  ) {
    this.status = "confirmed";
  }

  this.updatedBy = userId;
  await this.save();
};

appointmentSchema.methods.cancel = async function (reason, userId) {
  this.status = "cancelled";
  this.cancellationReason = reason;
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.updatedBy = userId;
  await this.save();
};

appointmentSchema.methods.complete = async function (notes, userId) {
  this.status = "completed";
  this.notes = notes || this.notes;
  this.updatedBy = userId;
  await this.save();
};

appointmentSchema.methods.markAttendance = async function (
  userId,
  role,
  attended,
) {
  if (role === "supplier") {
    this.supplierAttended = attended;
  } else if (role === "buyer") {
    this.buyerAttended = attended;
  } else {
    this.staffAttended = attended;
  }

  // Update participants array
  const participant = this.participants.find(
    (p) => p.user.toString() === userId,
  );
  if (participant) {
    participant.attended = attended;
    participant.joinedAt = attended ? new Date() : null;
  }

  this.updatedBy = userId;
  await this.save();
};

// Static Methods
appointmentSchema.statics.getUpcomingAppointments = async function (days = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return this.find({
    scheduledDate: { $gte: new Date(), $lte: endDate },
    status: { $in: ["confirmed", "pending"] },
    isActive: true,
  })
    .populate("supplier", "fullName email phone")
    .populate("buyer", "fullName email phone")
    .sort("scheduledDate");
};

appointmentSchema.statics.getTodayAppointments = async function () {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["confirmed", "pending"] },
    isActive: true,
  })
    .populate("supplier", "fullName email phone")
    .populate("buyer", "fullName email phone")
    .sort("scheduledDate");
};

appointmentSchema.statics.getAppointmentStats = async function () {
  const stats = await this.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await this.countDocuments({
    scheduledDate: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    },
    status: { $in: ["confirmed", "pending"] },
  });

  return { stats, todayCount };
};

module.exports = mongoose.model("Appointment", appointmentSchema);

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    userEmail: {
      type: String,
      index: true,
    },

    userRole: {
      type: String,
      enum: ["admin", "staff", "supplier", "buyer"],
      index: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        // Auth actions
        "LOGIN",
        "LOGOUT",
        "LOGIN_FAILED",
        "PASSWORD_CHANGE",
        "PASSWORD_RESET_REQUEST",
        "PASSWORD_RESET",
        "EMAIL_VERIFICATION",

        // User management
        "USER_CREATE",
        "USER_UPDATE",
        "USER_DELETE",
        "USER_SUSPEND",
        "USER_ACTIVATE",
        "USER_APPROVE",
        "USER_REJECT",
        "USER_ROLE_CHANGE",

        // KYC actions
        "KYC_SUBMIT",
        "KYC_REVIEW",
        "KYC_APPROVE",
        "KYC_REJECT",

        // Opportunity actions
        "OPPORTUNITY_CREATE",
        "OPPORTUNITY_UPDATE",
        "OPPORTUNITY_DELETE",
        "OPPORTUNITY_APPROVE",
        "OPPORTUNITY_REJECT",

        // Inventory actions
        "INVENTORY_CREATE",
        "INVENTORY_UPDATE",
        "INVENTORY_DELETE",
        "INVENTORY_APPROVE",
        "INVENTORY_REJECT",
        "INVENTORY_RESERVE",
        "INVENTORY_RELEASE",
        "INVENTORY_SOLD",

        // RFQ actions
        "RFQ_CREATE",
        "RFQ_UPDATE",
        "RFQ_RESPOND",
        "RFQ_ACCEPT",
        "RFQ_REJECT",
        "RFQ_NEGOTIATE",

        // Appointment actions
        "APPOINTMENT_CREATE",
        "APPOINTMENT_UPDATE",
        "APPOINTMENT_CONFIRM",
        "APPOINTMENT_CANCEL",
        "APPOINTMENT_COMPLETE",
        "APPOINTMENT_RESCHEDULE",

        // Message actions
        "MESSAGE_SEND",
        "MESSAGE_READ",
        "MESSAGE_DELETE",

        // Notification actions
        "NOTIFICATION_SEND",
        "NOTIFICATION_READ",
        "NOTIFICATION_DISMISS",

        // Settings actions
        "SETTINGS_UPDATE",
        "PROFILE_UPDATE",
        "PREFERENCES_UPDATE",

        // Export actions
        "DATA_EXPORT",
        "REPORT_GENERATE",

        // System actions
        "SYSTEM_BACKUP",
        "SYSTEM_RESTORE",
        "SYSTEM_MAINTENANCE",
      ],
      index: true,
    },

    module: {
      type: String,
      required: true,
      enum: [
        "auth",
        "users",
        "kyc",
        "opportunities",
        "inventory",
        "rfq",
        "appointments",
        "messages",
        "notifications",
        "settings",
        "reports",
        "system",
        "dashboard",
      ],
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    entityType: {
      type: String,
    },

    // Detailed changes
    details: {
      type: Object,
      default: {},
    },

    // Before and after states for updates
    before: {
      type: Object,
    },

    after: {
      type: Object,
    },

    // Status of the action
    status: {
      type: String,
      enum: ["success", "failure", "pending"],
      default: "success",
    },

    errorMessage: {
      type: String,
    },

    // Request information
    ipAddress: {
      type: String,
      required: true,
    },

    userAgent: {
      type: String,
    },

    requestId: {
      type: String,
      index: true,
    },

    sessionId: {
      type: String,
    },

    // Location information
    location: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number,
    },

    // Performance metrics
    duration: {
      type: Number, // in milliseconds
    },

    // Metadata
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Indexes for better query performance
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, module: 1 });
auditLogSchema.index({ entityId: 1, entityType: 1 });
auditLogSchema.index({ ipAddress: 1 });
auditLogSchema.index({ status: 1 });

// Virtual for formatted timestamp
auditLogSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleString();
});

// Static methods
auditLogSchema.statics.getUserActivity = async function (userId, limit = 50) {
  return this.find({ user: userId }).sort("-createdAt").limit(limit);
};

auditLogSchema.statics.getEntityHistory = async function (entityId, entityType, limit = 50) {
  return this.find({ entityId, entityType })
    .populate("user", "fullName email role")
    .sort("-createdAt")
    .limit(limit);
};

auditLogSchema.statics.getModuleActivity = async function (module, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        module,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        actions: { $addToSet: "$action" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

auditLogSchema.statics.getSummary = async function (days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const summary = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          module: "$module",
          action: "$action",
          status: "$status",
        },
        count: { $sum: 1 },
        users: { $addToSet: "$user" },
      },
    },
    {
      $group: {
        _id: "$_id.module",
        actions: {
          $push: {
            action: "$_id.action",
            count: "$count",
            status: "$_id.status",
          },
        },
        totalActions: { $sum: "$count" },
        uniqueUsers: { $sum: { $size: "$users" } },
      },
    },
  ]);

  return summary;
};

// Create audit log entry
auditLogSchema.statics.log = async function (data) {
  const log = new this(data);
  await log.save();
  return log;
};

// Clean old logs (retention)
auditLogSchema.statics.cleanOldLogs = async function (retentionDays = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
  });

  console.log(`Cleaned ${result.deletedCount} audit logs older than ${retentionDays} days`);
  return result;
};

module.exports = mongoose.model("AuditLog", auditLogSchema);

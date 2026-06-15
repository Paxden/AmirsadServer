const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      index: true,
    },

    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      index: true,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
    },

    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      index: true,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      index: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        // Deal actions
        "DEAL_CREATED",
        "DEAL_STATUS_CHANGE",
        "DEAL_CLOSED",
        "DEAL_CANCELLED",

        // Inspection actions
        "INSPECTION_SCHEDULED",
        "INSPECTION_COMPLETED",

        // Offer actions
        "OFFER_MADE",
        "OFFER_ACCEPTED",
        "OFFER_REJECTED",

        // Payment actions
        "PAYMENT_RECORDED",

        // Delivery actions
        "DELIVERY_SCHEDULED",
        "DELIVERY_COMPLETED",

        // Task actions
        "TASK_CREATED",
        "TASK_STARTED",
        "TASK_COMPLETED",
        "TASK_UPDATED",

        // RFQ actions
        "RFQ_CREATED",
        "RFQ_UPDATED",
        "RFQ_APPROVED",
        "RFQ_REJECTED",

        // User actions
        "USER_REGISTERED",
        "USER_APPROVED",
        "KYC_SUBMITTED",
        "KYC_APPROVED",
        "KYC_REJECTED",
      ],
      index: true,
    },

    description: {
      type: String,
      required: true,
    },

    metadata: {
      type: Object,
      default: {},
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ deal: 1, createdAt: -1 });
activitySchema.index({ rfq: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });

// Virtuals
activitySchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString();
});

activitySchema.virtual("timeAgo").get(function () {
  const diff = Math.floor((new Date() - this.createdAt) / 1000);

  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return this.createdAt.toLocaleDateString();
});

// Static methods
activitySchema.statics.logActivity = async function (data) {
  const activity = new this({
    user: data.user,
    deal: data.deal,
    rfq: data.rfq,
    appointment: data.appointment,
    inventory: data.inventory,
    task: data.task,
    action: data.action,
    description: data.description,
    metadata: data.metadata || {},
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });

  await activity.save();
  return activity;
};

activitySchema.statics.getUserTimeline = async function (userId, limit = 50) {
  return this.find({ user: userId })
    .populate("user", "fullName email role")
    .populate("deal", "dealNumber status")
    .populate("rfq", "rfqNumber status")
    .populate("task", "title status")
    .sort("-createdAt")
    .limit(limit);
};

activitySchema.statics.getDealTimeline = async function (dealId, limit = 100) {
  return this.find({ deal: dealId })
    .populate("user", "fullName email role")
    .sort("createdAt")
    .limit(limit);
};

activitySchema.statics.getRecentActivities = async function (limit = 20) {
  return this.find()
    .populate("user", "fullName email role")
    .populate("deal", "dealNumber")
    .populate("rfq", "rfqNumber")
    .populate("task", "title")
    .sort("-createdAt")
    .limit(limit);
};

activitySchema.statics.getActivitySummary = async function (days = 7) {
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
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          action: "$action",
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.date",
        actions: {
          $push: {
            action: "$_id.action",
            count: "$count",
          },
        },
        total: { $sum: "$count" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return summary;
};

// Remove any top-level await if present
module.exports = mongoose.model("Activity", activitySchema);

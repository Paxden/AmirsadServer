const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "message",
        "rfq",
        "appointment",
        "inventory",
        "kyc",
        "system",
        "alert",
        "reminder",
      ],
      default: "system",
      index: true,
    },

    // Priority levels
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    // Related entity
    relatedType: {
      type: String,
      enum: ["rfq", "appointment", "inventory", "kyc", "user", "message"],
    },

    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: Date,

    isDismissed: {
      type: Boolean,
      default: false,
    },

    // Action buttons
    actionUrl: {
      type: String,
    },

    actionLabel: {
      type: String,
    },

    // Email/SMS flags
    emailSent: {
      type: Boolean,
      default: false,
    },

    smsSent: {
      type: Boolean,
      default: false,
    },

    // Expiry
    expiresAt: Date,

    // Icon and color for UI
    icon: {
      type: String,
      default: "bell",
    },

    color: {
      type: String,
      default: "primary",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Indexes
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, priority: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtuals
notificationSchema.virtual("timeAgo").get(function () {
  const diff = Math.floor((new Date() - this.createdAt) / 1000);

  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return this.createdAt.toLocaleDateString();
});

// Static methods
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    user: userId,
    isRead: false,
    isDismissed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  });
};

notificationSchema.statics.getUserNotifications = async function (
  userId,
  limit = 20,
  skip = 0,
) {
  return this.find({
    user: userId,
    isDismissed: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

notificationSchema.statics.markAsRead = async function (
  notificationId,
  userId,
) {
  return this.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true, readAt: new Date() },
    { new: true },
  );
};

notificationSchema.statics.markAllAsRead = async function (userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );
};

// Method to create notification
notificationSchema.statics.createNotification = async function (data) {
  const notification = new this(data);
  await notification.save();
  return notification;
};

module.exports = mongoose.model("Notification", notificationSchema);

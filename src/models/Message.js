const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      default: "",
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Message threading
    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    conversationId: {
      type: String,
      index: true,
    },

    // Related entity
    relatedType: {
      type: String,
      enum: ["general", "rfq", "appointment", "inventory", "kyc", "quotation"],
      default: "general",
    },

    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Status tracking
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: Date,

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Attachments
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
      },
    ],

    // Priority
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

// Indexes
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ relatedType: 1, relatedId: 1 });
messageSchema.index({ isRead: 1, receiver: 1 });

// Virtual for message thread
messageSchema.virtual("isUnread").get(function () {
  return !this.isRead;
});

// Pre-save middleware to generate conversation ID
messageSchema.pre("save", function (next) {
  if (!this.conversationId) {
    // Create consistent conversation ID regardless of order
    const participants = [
      this.sender.toString(),
      this.receiver.toString(),
    ].sort();
    this.conversationId = participants.join("_");
  }
  next();
});

// Static methods
messageSchema.statics.getConversation = async function (
  userId,
  otherUserId,
  limit = 50,
) {
  const conversationId = [userId, otherUserId].sort().join("_");

  return this.find({
    conversationId,
    isDeleted: false,
  })
    .populate("sender", "fullName email role profile")
    .populate("receiver", "fullName email role profile")
    .sort({ createdAt: 1 })
    .limit(limit);
};

messageSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false,
  });
};

messageSchema.statics.markAsRead = async function (messageId, userId) {
  return this.findByIdAndUpdate(
    messageId,
    { isRead: true, readAt: new Date() },
    { new: true },
  );
};

messageSchema.statics.markConversationAsRead = async function (
  userId,
  otherUserId,
) {
  const conversationId = [userId, otherUserId].sort().join("_");

  return this.updateMany(
    {
      conversationId,
      receiver: userId,
      isRead: false,
    },
    { isRead: true, readAt: new Date() },
  );
};

module.exports = mongoose.model("Message", messageSchema);

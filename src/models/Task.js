const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    taskNumber: {
      type: String,
      unique: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Related Entities
    relatedTo: {
      type: {
        type: String,
        enum: ["deal", "rfq", "inventory", "kyc", "appointment", "none"],
        default: "none",
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },

    // Dates
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },

    startedAt: Date,
    completedAt: Date,

    // Priority
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled", "overdue"],
      default: "pending",
      index: true,
    },

    // Categories
    category: {
      type: String,
      enum: [
        "inspection",
        "document_verification",
        "kyc_review",
        "inventory_check",
        "buyer_followup",
        "supplier_followup",
        "appointment",
        "quality_assurance",
        "reporting",
        "other",
      ],
      default: "other",
    },

    // Labels/Tags
    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    // Comments/Updates
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Attachments
    attachments: [
      {
        name: String,
        url: String,
        type: String,
        size: Number,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Reminders
    reminders: [
      {
        scheduledFor: Date,
        sentAt: Date,
        type: {
          type: String,
          enum: ["email", "notification"],
        },
      },
    ],

    // Recurring Task
    isRecurring: {
      type: Boolean,
      default: false,
    },

    recurrencePattern: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
    },

    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },

    subTasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],

    // Time Tracking
    timeSpent: {
      type: Number, // in minutes
      default: 0,
    },

    timeLogs: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        startTime: Date,
        endTime: Date,
        duration: Number, // minutes
        notes: String,
      },
    ],

    // Approval
    requiresApproval: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    // Metadata
    metadata: {
      type: Object,
      default: {},
    },

    // Soft Delete
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// taskSchema.index({ taskNumber: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedTo: 1, dueDate: 1 });
taskSchema.index({ priority: 1, status: 1 });
taskSchema.index({ "relatedTo.type": 1, "relatedTo.id": 1 });
taskSchema.index({ dueDate: 1, status: 1 });

// Virtuals
taskSchema.virtual("isOverdue").get(function () {
  return this.status === "pending" && this.dueDate < new Date();
});

taskSchema.virtual("daysRemaining").get(function () {
  const diff = this.dueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

taskSchema.virtual("completionPercentage").get(function () {
  if (this.status === "completed") return 100;
  if (this.status === "in_progress") return 50;
  return 0;
});

// Pre-save middleware
taskSchema.pre("save", async function () {
  // Generate task number if not exists
  if (!this.taskNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const count = await mongoose.model("Task").countDocuments();
    const sequence = String(count + 1).padStart(6, "0");
    this.taskNumber = `TSK-${year}${month}-${sequence}`;
  }

  // Auto-set overdue status
  if (this.dueDate < new Date() && this.status === "pending") {
    this.status = "overdue";
  }

});

// Methods
taskSchema.methods.start = async function (userId) {
  this.status = "in_progress";
  this.startedAt = new Date();
  await this.save();

  // Log activity
  await mongoose.model("Activity").logActivity({
    user: userId,
    action: "TASK_STARTED",
    description: `Started task: ${this.title}`,
    metadata: { taskId: this._id, taskNumber: this.taskNumber },
  });

  return this;
};

taskSchema.methods.complete = async function (userId) {
  this.status = "completed";
  this.completedAt = new Date();
  await this.save();

  // Log activity
  await mongoose.model("Activity").logActivity({
    user: userId,
    action: "TASK_COMPLETED",
    description: `Completed task: ${this.title}`,
    metadata: { taskId: this._id, taskNumber: this.taskNumber },
  });

  return this;
};

taskSchema.methods.addComment = async function (userId, message) {
  this.comments.push({
    user: userId,
    message,
  });
  await this.save();
  return this;
};

taskSchema.methods.logTime = async function (userId, startTime, endTime, notes) {
  const duration = Math.ceil((endTime - startTime) / (1000 * 60));

  this.timeLogs.push({
    user: userId,
    startTime,
    endTime,
    duration,
    notes,
  });

  this.timeSpent += duration;
  await this.save();

  return this;
};

// Static methods
taskSchema.statics.getUserTasks = async function (userId, filters = {}) {
  const query = { assignedTo: userId, isActive: true };

  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.category) query.category = filters.category;

  return this.find(query)
    .populate("createdBy", "fullName email")
    .populate("assignedTo", "fullName email")
    .sort({ priority: -1, dueDate: 1 });
};

taskSchema.statics.getOverdueTasks = async function () {
  return this.find({
    status: { $in: ["pending", "in_progress"] },
    dueDate: { $lt: new Date() },
    isActive: true,
  }).populate("assignedTo", "fullName email");
};

taskSchema.statics.getTaskSummary = async function () {
  const summary = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const prioritySummary = await this.aggregate([
    { $match: { isActive: true, status: { $ne: "completed" } } },
    {
      $group: {
        _id: "$priority",
        count: { $sum: 1 },
      },
    },
  ]);

  return { byStatus: summary, byPriority: prioritySummary };
};

module.exports = mongoose.model("Task", taskSchema);

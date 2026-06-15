const Task = require("../models/Task");
const Activity = require("../models/Activity");
const NotificationService = require("../services/notificationService");

// Safe activity logger
const safeLogActivity = async (data) => {
  try {
    if (Activity && Activity.logActivity) {
      await Activity.logActivity(data);
    }
  } catch (error) {
    console.error("Activity logging failed:", error.message);
  }
};

/**
 * Create new task
 */
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      dueDate,
      priority,
      category,
      relatedTo,
      tags,
      requiresApproval,
    } = req.body;

    if (!title || !description || !assignedTo || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, description, assignedTo, dueDate",
      });
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      createdBy: req.user.id,
      dueDate: new Date(dueDate),
      priority: priority || "medium",
      category: category || "other",
      relatedTo: relatedTo || { type: "none" },
      tags: tags || [],
      requiresApproval: requiresApproval || false,
    });

    // Send notification to assigned user
    await NotificationService.send(assignedTo, {
      title: "New Task Assigned",
      message: `You have been assigned a new task: ${title}`,
      type: "system",
      priority: priority === "urgent" ? "high" : "normal",
      relatedType: "task",
      relatedId: task._id,
      actionUrl: `/dashboard/tasks/${task._id}`,
      actionLabel: "View Task",
    });

    // Log activity
    await safeLogActivity({
      user: req.user.id,
      task: task._id,
      action: "TASK_CREATED",
      description: `Created task: ${title} assigned to ${assignedTo}`,
      metadata: { taskId: task._id, taskNumber: task.taskNumber },
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: error.message,
    });
  }
};

/**
 * Get user's tasks
 */
exports.getMyTasks = async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 20 } = req.query;

    const query = { assignedTo: req.user.id, isActive: true };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    const tasks = await Task.find(query)
      .populate("createdBy", "fullName email")
      .populate("assignedTo", "fullName email")
      .sort({ priority: -1, dueDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(query);

    const summary = await Task.getTaskSummary();

    res.status(200).json({
      success: true,
      tasks,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      summary,
    });
  } catch (error) {
    console.error("Get my tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
    });
  }
};

/**
 * Get task by ID
 */
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id)
      .populate("assignedTo", "fullName email role")
      .populate("createdBy", "fullName email")
      .populate("comments.user", "fullName email");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check authorization
    if (
      task.assignedTo._id.toString() !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "staff"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task",
    });
  }
};

/**
 * Update task
 */
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check authorization
    if (
      task.assignedTo.toString() !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "staff"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Allowed updates
    const allowedUpdates = [
      "title",
      "description",
      "dueDate",
      "priority",
      "status",
      "category",
      "tags",
      "requiresApproval",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });

    await task.save();

    // Log activity
    await safeLogActivity({
      user: req.user.id,
      task: task._id,
      action: "TASK_UPDATED",
      description: `Updated task: ${task.title}`,
      metadata: { taskId: task._id, updates },
    });

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task",
    });
  }
};

/**
 * Start task
 */
exports.startTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned user can start this task",
      });
    }

    task.status = "in_progress";
    task.startedAt = new Date();
    await task.save();

    await safeLogActivity({
      user: req.user.id,
      task: task._id,
      action: "TASK_STARTED",
      description: `Started task: ${task.title}`,
      metadata: { taskId: task._id, taskNumber: task.taskNumber },
    });

    res.status(200).json({
      success: true,
      message: "Task started",
      task,
    });
  } catch (error) {
    console.error("Start task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start task",
    });
  }
};

/**
 * Complete task
 */
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned user can complete this task",
      });
    }

    task.status = "completed";
    task.completedAt = new Date();
    await task.save();

    // Notify creator
    await NotificationService.send(task.createdBy, {
      title: "Task Completed",
      message: `Task "${task.title}" has been completed by ${req.user.fullName}`,
      type: "system",
      priority: "normal",
      relatedType: "task",
      relatedId: task._id,
      actionUrl: `/dashboard/tasks/${task._id}`,
      actionLabel: "View Task",
    });

    await safeLogActivity({
      user: req.user.id,
      task: task._id,
      action: "TASK_COMPLETED",
      description: `Completed task: ${task.title}`,
      metadata: { taskId: task._id, notes },
    });

    res.status(200).json({
      success: true,
      message: "Task completed",
      task,
    });
  } catch (error) {
    console.error("Complete task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete task",
    });
  }
};

/**
 * Add comment to task
 */
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Comment message is required",
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    task.comments.push({
      user: req.user.id,
      message,
      createdAt: new Date(),
    });
    await task.save();

    // Notify assigned user if not the commenter
    if (task.assignedTo.toString() !== req.user.id) {
      await NotificationService.send(task.assignedTo, {
        title: "New Comment on Task",
        message: `${req.user.fullName} commented on task: ${task.title}`,
        type: "system",
        priority: "normal",
        relatedType: "task",
        relatedId: task._id,
        actionUrl: `/dashboard/tasks/${task._id}`,
        actionLabel: "View Comment",
      });
    }

    res.status(200).json({
      success: true,
      message: "Comment added",
      task,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
  }
};

/**
 * Log time on task
 */
exports.logTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, notes } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = Math.ceil((end - start) / (1000 * 60));

    task.timeLogs.push({
      user: req.user.id,
      startTime: start,
      endTime: end,
      duration,
      notes,
    });

    task.timeSpent += duration;
    await task.save();

    res.status(200).json({
      success: true,
      message: "Time logged successfully",
      timeSpent: task.timeSpent,
    });
  } catch (error) {
    console.error("Log time error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log time",
    });
  }
};

/**
 * Get task statistics (Admin only)
 */
exports.getTaskStats = async (req, res) => {
  try {
    const summary = await Task.getTaskSummary();
    const overdueTasks = await Task.getOverdueTasks();

    const tasksByUser = await Task.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$assignedTo",
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $project: { "user.password": 0 } },
    ]);

    res.status(200).json({
      success: true,
      summary,
      overdueCount: overdueTasks.length,
      tasksByUser,
    });
  } catch (error) {
    console.error("Get task stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task statistics",
    });
  }
};

/**
 * Delete task
 */
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByIdAndUpdate(id, {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete task",
    });
  }
};

const AuditLog = require("../models/AuditLog");
const User = require("../models/User");

/**
 * Get all audit logs (Admin only)
 */
exports.getAllAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      user,
      action,
      module,
      status,
      startDate,
      endDate,
      entityId,
      search,
    } = req.query;

    const query = {};

    if (user) query.user = user;
    if (action) query.action = action;
    if (module) query.module = module;
    if (status) query.status = status;
    if (entityId) query.entityId = entityId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
        { "details.url": { $regex: search, $options: "i" } },
      ];
    }

    const logs = await AuditLog.find(query)
      .populate("user", "fullName email role")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      success: true,
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
};

/**
 * Get user activity log
 */
exports.getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const logs = await AuditLog.getUserActivity(userId, parseInt(limit));

    res.status(200).json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("Get user activity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user activity",
    });
  }
};

/**
 * Get entity history
 */
exports.getEntityHistory = async (req, res) => {
  try {
    const { entityId, entityType } = req.params;
    const { limit = 50 } = req.query;

    const logs = await AuditLog.getEntityHistory(entityId, entityType, parseInt(limit));

    res.status(200).json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("Get entity history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch entity history",
    });
  }
};

/**
 * Get audit summary
 */
exports.getAuditSummary = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const summary = await AuditLog.getSummary(parseInt(days));
    const totalCount = await AuditLog.countDocuments();

    // Get top active users
    const topUsers = await AuditLog.aggregate([
      {
        $group: {
          _id: "$user",
          userEmail: { $first: "$userEmail" },
          count: { $sum: 1 },
          lastAction: { $max: "$createdAt" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Populate user details
    const populatedTopUsers = await User.populate(topUsers, {
      path: "_id",
      select: "fullName email role",
    });

    res.status(200).json({
      success: true,
      summary: {
        moduleBreakdown: summary,
        totalLogs: totalCount,
        topActiveUsers: populatedTopUsers.map((u) => ({
          user: u._id,
          email: u.userEmail,
          actionCount: u.count,
          lastAction: u.lastAction,
        })),
      },
    });
  } catch (error) {
    console.error("Get audit summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit summary",
    });
  }
};

/**
 * Get audit statistics
 */
exports.getAuditStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const thisMonth = new Date();
    thisMonth.setDate(thisMonth.getDate() - 30);

    const [
      totalLogs,
      todayLogs,
      weeklyLogs,
      monthlyLogs,
      actionBreakdown,
      moduleBreakdown,
      statusBreakdown,
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: today } }),
      AuditLog.countDocuments({ createdAt: { $gte: thisWeek } }),
      AuditLog.countDocuments({ createdAt: { $gte: thisMonth } }),
      AuditLog.aggregate([
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.aggregate([
        { $group: { _id: "$module", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        total: totalLogs,
        today: todayLogs,
        weekly: weeklyLogs,
        monthly: monthlyLogs,
        topActions: actionBreakdown,
        moduleBreakdown,
        statusBreakdown,
      },
    });
  } catch (error) {
    console.error("Get audit stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit statistics",
    });
  }
};

/**
 * Export audit logs
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const { format = "json", startDate, endDate } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate("user", "fullName email role")
      .sort("-createdAt")
      .lean();

    if (format === "csv") {
      // Convert to CSV
      const csvHeaders = [
        "Timestamp",
        "User",
        "Email",
        "Role",
        "Action",
        "Module",
        "Status",
        "IP Address",
        "Details",
      ];
      const csvRows = logs.map((log) => [
        log.createdAt,
        log.user?.fullName || "System",
        log.userEmail || "N/A",
        log.userRole || "N/A",
        log.action,
        log.module,
        log.status,
        log.ipAddress,
        JSON.stringify(log.details),
      ]);

      const csv = [csvHeaders, ...csvRows].map((row) => row.join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${Date.now()}.csv`);
      return res.send(csv);
    } else {
      // JSON format
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=audit-logs-${Date.now()}.json`);
      return res.json(logs);
    }
  } catch (error) {
    console.error("Export audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export audit logs",
    });
  }
};

/**
 * Clean old audit logs (Admin only)
 */
exports.cleanOldLogs = async (req, res) => {
  try {
    const { retentionDays = 90 } = req.body;

    const result = await AuditLog.cleanOldLogs(retentionDays);

    // Log the cleanup action
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "SYSTEM_MAINTENANCE",
      module: "system",
      details: {
        action: "clean_audit_logs",
        retentionDays,
        deletedCount: result.deletedCount,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: `Cleaned ${result.deletedCount} old audit logs`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Clean old logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clean old logs",
    });
  }
};

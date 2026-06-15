const User = require("../models/User");
const SupplierProfile = require("../models/SupplierProfile");
const BuyerProfile = require("../models/BuyerProfile");
const Opportunity = require("../models/Opportunity");
const Inventory = require("../models/Inventory");
const RFQ = require("../models/RFQ");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Message = require("../models/Message");

/**
 * Admin Dashboard - Complete platform analytics
 */
exports.adminDashboard = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      // User Statistics
      totalUsers,
      totalSuppliers,
      totalBuyers,
      activeUsers,
      newUsersThisMonth,

      // KYC Statistics
      pendingSupplierKyc,
      pendingBuyerKyc,
      approvedSupplierKyc,
      approvedBuyerKyc,
      rejectedKyc,

      // Opportunity & Inventory Statistics
      totalOpportunities,
      pendingOpportunities,
      approvedOpportunities,
      totalInventory,
      availableInventory,
      totalInventoryValue,

      // RFQ Statistics
      totalRFQs,
      pendingRFQs,
      quotedRFQs,
      acceptedRFQs,
      totalRFQValue,

      // Appointment Statistics
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,

      // Financial Statistics
      totalTransactionValue,

      // Recent Activity
      recentUsers,
      recentRFQs,
      recentAppointments,

      // Notification Statistics
      totalNotifications,
      unreadNotifications,

      // Message Statistics
      totalMessages,
      unreadMessages,
    ] = await Promise.all([
      // User Statistics
      User.countDocuments(),
      User.countDocuments({ role: "supplier", deletedAt: null }),
      User.countDocuments({ role: "buyer", deletedAt: null }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),

      // KYC Statistics
      SupplierProfile.countDocuments({ kycStatus: "under_review" }),
      BuyerProfile.countDocuments({ kycStatus: "under_review" }),
      SupplierProfile.countDocuments({ kycStatus: "approved" }),
      BuyerProfile.countDocuments({ kycStatus: "approved" }),
      SupplierProfile.countDocuments({ kycStatus: "rejected" }),

      // Opportunity & Inventory Statistics
      Opportunity.countDocuments(),
      Opportunity.countDocuments({ status: "pending" }),
      Opportunity.countDocuments({ status: "approved" }),
      Inventory.countDocuments({ isActive: true }),
      Inventory.countDocuments({ status: "available", isActive: true }),
      Inventory.aggregate([
        { $match: { status: "available", isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ["$availableWeightKg", "$askingPrice"] } },
          },
        },
      ]),

      // RFQ Statistics
      RFQ.countDocuments({ isActive: true }),
      RFQ.countDocuments({ status: "pending" }),
      RFQ.countDocuments({ status: "quoted" }),
      RFQ.countDocuments({ status: "accepted" }),
      RFQ.aggregate([
        { $match: { status: "accepted", isActive: true } },
        { $group: { _id: null, total: { $sum: "$finalTotalPrice" } } },
      ]),

      // Appointment Statistics
      Appointment.countDocuments({ isActive: true }),
      Appointment.countDocuments({ scheduledDate: { $gte: new Date() }, status: "confirmed" }),
      Appointment.countDocuments({ status: "completed" }),
      Appointment.countDocuments({ status: "cancelled" }),

      // Financial Statistics
      RFQ.aggregate([
        { $match: { status: "accepted", isActive: true } },
        { $group: { _id: null, total: { $sum: "$finalTotalPrice" } } },
      ]),

      // Recent Activity
      User.find().sort("-createdAt").limit(5).select("fullName email role createdAt"),
      RFQ.find().populate("buyer", "fullName").sort("-createdAt").limit(5),
      Appointment.find().populate("buyer supplier", "fullName").sort("-createdAt").limit(5),

      // Notification Statistics
      Notification.countDocuments(),
      Notification.countDocuments({ isRead: false }),

      // Message Statistics
      Message.countDocuments({ isDeleted: false }),
      Message.countDocuments({ isRead: false }),
    ]);

    // Calculate growth percentages
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthUsers = await User.countDocuments({
      createdAt: { $gte: lastMonth, $lt: startOfMonth },
    });
    const userGrowth =
      lastMonthUsers > 0 ? ((newUsersThisMonth - lastMonthUsers) / lastMonthUsers) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        // User Overview
        users: {
          total: totalUsers,
          suppliers: totalSuppliers,
          buyers: totalBuyers,
          active: activeUsers,
          newThisMonth: newUsersThisMonth,
          growth: userGrowth.toFixed(1),
        },

        // KYC Overview
        kyc: {
          pending: {
            suppliers: pendingSupplierKyc,
            buyers: pendingBuyerKyc,
            total: pendingSupplierKyc + pendingBuyerKyc,
          },
          approved: {
            suppliers: approvedSupplierKyc,
            buyers: approvedBuyerKyc,
            total: approvedSupplierKyc + approvedBuyerKyc,
          },
          rejected: rejectedKyc,
        },

        // Opportunities & Inventory
        opportunities: {
          total: totalOpportunities,
          pending: pendingOpportunities,
          approved: approvedOpportunities,
          approvalRate:
            totalOpportunities > 0
              ? ((approvedOpportunities / totalOpportunities) * 100).toFixed(1)
              : 0,
        },
        inventory: {
          total: totalInventory,
          available: availableInventory,
          totalValue: totalInventoryValue[0]?.total || 0,
        },

        // RFQ Analytics
        rfqs: {
          total: totalRFQs,
          pending: pendingRFQs,
          quoted: quotedRFQs,
          accepted: acceptedRFQs,
          conversionRate: totalRFQs > 0 ? ((acceptedRFQs / totalRFQs) * 100).toFixed(1) : 0,
          totalValue: totalRFQValue[0]?.total || 0,
        },

        // Appointments
        appointments: {
          total: totalAppointments,
          upcoming: upcomingAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments,
        },

        // Financial Summary
        financial: {
          totalTransactionValue: totalTransactionValue[0]?.total || 0,
          averageTransactionValue:
            acceptedRFQs > 0 ? (totalTransactionValue[0]?.total || 0) / acceptedRFQs : 0,
        },

        // Recent Activity
        recentActivity: {
          newUsers: recentUsers,
          recentRFQs: recentRFQs,
          recentAppointments: recentAppointments,
        },

        // Communication
        communication: {
          totalNotifications: totalNotifications,
          unreadNotifications: unreadNotifications,
          totalMessages: totalMessages,
          unreadMessages: unreadMessages,
        },
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard data",
      error: error.message,
    });
  }
};

/**
 * Staff Dashboard - Daily operations overview
 */
exports.staffDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      // Pending Reviews
      pendingSupplierKyc,
      pendingBuyerKyc,
      pendingOpportunities,
      pendingInventory,
      pendingRFQs,

      // Today's Schedule
      todayAppointments,
      upcomingAppointments,

      // Recent Activity
      recentRFQs,
      recentOpportunities,

      // Performance Metrics
      totalProcessedRFQs,
      totalProcessedKYC,
      totalApprovedInventory,

      // Alerts
      expiringInventory,
    ] = await Promise.all([
      // Pending Reviews
      SupplierProfile.countDocuments({ kycStatus: "under_review" }),
      BuyerProfile.countDocuments({ kycStatus: "under_review" }),
      Opportunity.countDocuments({ status: "pending" }),
      Inventory.countDocuments({ status: "pending_approval" }),
      RFQ.countDocuments({ status: "pending" }),

      // Today's Schedule
      Appointment.countDocuments({
        scheduledDate: { $gte: today, $lt: tomorrow },
        status: { $in: ["confirmed", "pending"] },
      }),
      Appointment.countDocuments({
        scheduledDate: { $gt: tomorrow },
        status: "confirmed",
      }),

      // Recent Activity
      RFQ.find()
        .populate("buyer", "fullName email")
        .populate("inventory", "weightKg purity")
        .sort("-createdAt")
        .limit(10),
      Opportunity.find().populate("supplier", "fullName email").sort("-createdAt").limit(10),

      // Performance Metrics
      RFQ.countDocuments({ reviewedBy: req.user.id }),
      SupplierProfile.countDocuments({ verifiedBy: req.user.id }) +
        BuyerProfile.countDocuments({ verifiedBy: req.user.id }),
      Inventory.countDocuments({ approvedBy: req.user.id }),

      // Alerts - Inventory expiring in 7 days
      Inventory.countDocuments({
        availableUntil: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), $gte: new Date() },
        status: "available",
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        // Pending Tasks
        pendingTasks: {
          kyc: {
            suppliers: pendingSupplierKyc,
            buyers: pendingBuyerKyc,
            total: pendingSupplierKyc + pendingBuyerKyc,
          },
          opportunities: pendingOpportunities,
          inventory: pendingInventory,
          rfqs: pendingRFQs,
          total:
            pendingSupplierKyc +
            pendingBuyerKyc +
            pendingOpportunities +
            pendingInventory +
            pendingRFQs,
        },

        // Today's Schedule
        schedule: {
          today: todayAppointments,
          upcoming: upcomingAppointments,
        },

        // Recent Activity
        recentActivity: {
          rfqs: recentRFQs,
          opportunities: recentOpportunities,
        },

        // Staff Performance
        performance: {
          processedRFQs: totalProcessedRFQs,
          processedKYC: totalProcessedKYC,
          approvedInventory: totalApprovedInventory,
        },

        // Alerts
        alerts: {
          expiringInventory: expiringInventory,
        },
      },
    });
  } catch (error) {
    console.error("Staff dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff dashboard data",
      error: error.message,
    });
  }
};

/**
 * Supplier Dashboard - Supplier's business overview
 */

exports.supplierDashboard = async (req, res) => {
  try {
    // Debug logging to see what we have
    console.log("req.user:", req.user);
    console.log("req.user._id:", req.user?._id);
    console.log("req.user.id:", req.user?.id);
    
    // Get user ID correctly - check multiple possible locations
    let supplierId = req.user?._id || req.user?.id || req.user?.userId;
    
    // If still undefined, try to get from token via req.user._id
    if (!supplierId && req.user && typeof req.user === 'object') {
      supplierId = req.user._id || req.user.id;
    }
    
    if (!supplierId) {
      console.error("No supplier ID found in request");
      return res.status(401).json({
        success: false,
        message: "User not authenticated - No ID found",
      });
    }

    console.log("Supplier ID found:", supplierId);

    // Convert to ObjectId if it's a string
    const mongoose = require("mongoose");
    const supplierObjectId = typeof supplierId === 'string' ? new mongoose.Types.ObjectId(supplierId) : supplierId;

    const [
      totalOpportunities,
      pendingOpportunities,
      approvedOpportunities,
      rejectedOpportunities,
      totalInventory,
      availableInventory,
      soldInventory,
      totalInventoryValue,
      totalRFQs,
      pendingRFQs,
      acceptedRFQs,
      totalRFQValue,
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      totalGoldSold,
      recentRFQs,
      recentAppointments,
      unreadNotifications,
    ] = await Promise.all([
      Opportunity.countDocuments({ supplier: supplierObjectId }),
      Opportunity.countDocuments({ supplier: supplierObjectId, status: "pending" }),
      Opportunity.countDocuments({ supplier: supplierObjectId, status: "approved" }),
      Opportunity.countDocuments({ supplier: supplierObjectId, status: "rejected" }),
      Inventory.countDocuments({ supplier: supplierObjectId, isActive: true }),
      Inventory.countDocuments({ supplier: supplierObjectId, status: "available" }),
      Inventory.countDocuments({ supplier: supplierObjectId, status: "sold" }),
      Inventory.aggregate([
        { $match: { supplier: supplierObjectId, status: "sold" } },
        { $group: { _id: null, total: { $sum: "$finalPrice" } } },
      ]),
      RFQ.countDocuments({ supplier: supplierObjectId }),
      RFQ.countDocuments({ supplier: supplierObjectId, status: "pending" }),
      RFQ.countDocuments({ supplier: supplierObjectId, status: "accepted" }),
      RFQ.aggregate([
        { $match: { supplier: supplierObjectId, status: "accepted" } },
        { $group: { _id: null, total: { $sum: "$finalTotalPrice" } } },
      ]),
      Appointment.countDocuments({ supplier: supplierObjectId }),
      Appointment.countDocuments({ 
        supplier: supplierObjectId, 
        scheduledDate: { $gte: new Date() }, 
        status: "confirmed" 
      }),
      Appointment.countDocuments({ supplier: supplierObjectId, status: "completed" }),
      Inventory.aggregate([
        { $match: { supplier: supplierObjectId, status: "sold" } },
        { $group: { _id: null, total: { $sum: "$weightKg" } } },
      ]),
      RFQ.find({ supplier: supplierObjectId })
        .populate("buyer", "fullName email")
        .sort("-createdAt")
        .limit(5)
        .lean(),
      Appointment.find({ supplier: supplierObjectId })
        .populate("buyer", "fullName email")
        .sort("-createdAt")
        .limit(5)
        .lean(),
      Notification.countDocuments({ user: supplierObjectId, isRead: false }),
    ]);

    // Calculate approval rate
    const totalDecisions = approvedOpportunities + rejectedOpportunities;
    const approvalRate = totalDecisions > 0 ? (approvedOpportunities / totalDecisions) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalOpportunities: totalOpportunities || 0,
          totalInventory: totalInventory || 0,
          totalRFQs: totalRFQs || 0,
          totalAppointments: totalAppointments || 0,
        },
        opportunities: {
          total: totalOpportunities || 0,
          pending: pendingOpportunities || 0,
          approved: approvedOpportunities || 0,
          rejected: rejectedOpportunities || 0,
          approvalRate: approvalRate.toFixed(1),
        },
        inventory: {
          total: totalInventory || 0,
          available: availableInventory || 0,
          sold: soldInventory || 0,
          totalValue: totalInventoryValue[0]?.total || 0,
          utilizationRate: totalInventory > 0 ? ((soldInventory / totalInventory) * 100).toFixed(1) : 0,
        },
        rfqs: {
          total: totalRFQs || 0,
          pending: pendingRFQs || 0,
          accepted: acceptedRFQs || 0,
          totalValue: totalRFQValue[0]?.total || 0,
          acceptanceRate: totalRFQs > 0 ? ((acceptedRFQs / totalRFQs) * 100).toFixed(1) : 0,
        },
        appointments: {
          total: totalAppointments || 0,
          upcoming: upcomingAppointments || 0,
          completed: completedAppointments || 0,
        },
        performance: {
          totalGoldSold: totalGoldSold[0]?.total || 0,
          averageDealSize: acceptedRFQs > 0 ? (totalRFQValue[0]?.total || 0) / acceptedRFQs : 0,
        },
        recentActivity: {
          rfqs: recentRFQs || [],
          appointments: recentAppointments || [],
        },
        unreadNotifications: unreadNotifications || 0,
        kycStatus: "approved", // You can fetch this from user profile
        approvalStatus: "approved",
      },
    });
  } catch (error) {
    console.error("Supplier dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier dashboard data",
      error: error.message,
    });
  }
};

/**
 * Buyer Dashboard - Buyer's trading overview
 */
/**
 * Buyer Dashboard - Buyer's trading overview
 */
exports.buyerDashboard = async (req, res) => {
  try {
    // Get user ID correctly
    let buyerId = req.user?._id || req.user?.id || req.user?.userId;
    
    if (!buyerId && req.user && typeof req.user === 'object') {
      buyerId = req.user._id || req.user.id;
    }
    
    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const mongoose = require("mongoose");
    const buyerObjectId = typeof buyerId === 'string' ? new mongoose.Types.ObjectId(buyerId) : buyerId;

    const [
      totalRFQs,
      pendingRFQs,
      quotedRFQs,
      acceptedRFQs,
      rejectedRFQs,
      totalPurchaseValue,
      availableInventory,
      totalAvailableWeight,
      totalAvailableValue,
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      totalGoldPurchased,
      recentRFQs,
      recentAppointments,
      unreadNotifications,
      unreadMessages,
    ] = await Promise.all([
      RFQ.countDocuments({ buyer: buyerObjectId }),
      RFQ.countDocuments({ buyer: buyerObjectId, status: "pending" }),
      RFQ.countDocuments({ buyer: buyerObjectId, status: "quoted" }),
      RFQ.countDocuments({ buyer: buyerObjectId, status: "accepted" }),
      RFQ.countDocuments({ buyer: buyerObjectId, status: "rejected" }),
      RFQ.aggregate([
        { $match: { buyer: buyerObjectId, status: "accepted" } },
        { $group: { _id: null, total: { $sum: "$finalTotalPrice" } } }
      ]),
      Inventory.countDocuments({ status: "available", isActive: true }),
      Inventory.aggregate([
        { $match: { status: "available", isActive: true } },
        { $group: { _id: null, total: { $sum: "$availableWeightKg" } } }
      ]),
      Inventory.aggregate([
        { $match: { status: "available", isActive: true } },
        { $group: { _id: null, total: { $sum: { $multiply: ["$availableWeightKg", "$askingPrice"] } } } }
      ]),
      Appointment.countDocuments({ buyer: buyerObjectId }),
      Appointment.countDocuments({ 
        buyer: buyerObjectId, 
        scheduledDate: { $gte: new Date() }, 
        status: "confirmed" 
      }),
      Appointment.countDocuments({ buyer: buyerObjectId, status: "completed" }),
      RFQ.aggregate([
        { $match: { buyer: buyerObjectId, status: "accepted" } },
        { $group: { _id: null, total: { $sum: "$requestedWeightKg" } } }
      ]),
      RFQ.find({ buyer: buyerObjectId })
        .populate("inventory", "weightKg purity askingPrice")
        .sort("-createdAt")
        .limit(5)
        .lean(),
      Appointment.find({ buyer: buyerObjectId })
        .populate("supplier", "fullName email")
        .sort("-createdAt")
        .limit(5)
        .lean(),
      Notification.countDocuments({ user: buyerObjectId, isRead: false }),
      Message.countDocuments({ receiver: buyerObjectId, isRead: false }),
    ]);

    const responseRate = totalRFQs > 0 ? ((quotedRFQs / totalRFQs) * 100).toFixed(1) : 0;
    const acceptanceRate = quotedRFQs > 0 ? ((acceptedRFQs / quotedRFQs) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalRFQs: totalRFQs || 0,
          totalAppointments: totalAppointments || 0,
          availableInventory: availableInventory || 0,
          totalPurchased: totalGoldPurchased[0]?.total || 0,
        },
        rfqs: {
          total: totalRFQs || 0,
          pending: pendingRFQs || 0,
          quoted: quotedRFQs || 0,
          accepted: acceptedRFQs || 0,
          rejected: rejectedRFQs || 0,
          responseRate: responseRate,
          acceptanceRate: acceptanceRate,
          totalValue: totalPurchaseValue[0]?.total || 0,
        },
        market: {
          availableInventory: availableInventory || 0,
          totalAvailableWeight: totalAvailableWeight[0]?.total || 0,
          totalAvailableValue: totalAvailableValue[0]?.total || 0,
        },
        appointments: {
          total: totalAppointments || 0,
          upcoming: upcomingAppointments || 0,
          completed: completedAppointments || 0,
        },
        performance: {
          totalGoldPurchased: totalGoldPurchased[0]?.total || 0,
          averagePurchaseSize: acceptedRFQs > 0 ? (totalPurchaseValue[0]?.total || 0) / acceptedRFQs : 0,
        },
        recentActivity: {
          rfqs: recentRFQs || [],
          appointments: recentAppointments || [],
        },
        communication: {
          unreadNotifications: unreadNotifications || 0,
          unreadMessages: unreadMessages || 0,
        },
      },
    });
  } catch (error) {
    console.error("Buyer dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyer dashboard data",
      error: error.message,
    });
  }
};

/**
 * Get dashboard charts data
 */
exports.getDashboardCharts = async (req, res) => {
  try {
    const { role, period = "month" } = req.query;
    const userId = req.user.id;

    let dateRange = {};
    const now = new Date();

    switch (period) {
      case "week":
        dateRange.start = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        dateRange.start = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        dateRange.start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        dateRange.start = new Date(now.setMonth(now.getMonth() - 1));
    }

    let chartData = {};

    if (role === "admin" || role === "staff") {
      // RFQ Trend
      const rfqTrend = await RFQ.aggregate([
        { $match: { createdAt: { $gte: dateRange.start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            value: { $sum: "$offeredTotalPrice" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // User Registration Trend
      const userTrend = await User.aggregate([
        { $match: { createdAt: { $gte: dateRange.start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            suppliers: { $sum: { $cond: [{ $eq: ["$role", "supplier"] }, 1, 0] } },
            buyers: { $sum: { $cond: [{ $eq: ["$role", "buyer"] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      chartData = { rfqTrend, userTrend };
    } else if (role === "supplier") {
      // Supplier's RFQ Trend
      const rfqTrend = await RFQ.aggregate([
        { $match: { supplier: userId._id || userId, createdAt: { $gte: dateRange.start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            value: { $sum: "$offeredTotalPrice" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      chartData = { rfqTrend };
    } else if (role === "buyer") {
      // Buyer's RFQ Trend
      const rfqTrend = await RFQ.aggregate([
        { $match: { buyer: userId._id || userId, createdAt: { $gte: dateRange.start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            value: { $sum: "$offeredTotalPrice" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      chartData = { rfqTrend };
    }

    res.status(200).json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error("Get charts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chart data",
    });
  }
};

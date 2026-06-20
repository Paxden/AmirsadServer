const User = require("../models/User");
const SupplierProfile = require("../models/SupplierProfile");
const BuyerProfile = require("../models/BuyerProfile");
const AuditLog = require("../models/AuditLog");
const NotificationService = require("../services/notificationService");
const bcrypt = require("bcryptjs");

/**
 * Get all users with filtering and pagination
 */
exports.getAllUsers = async (req, res) => {
  try {
    const {
      role,
      isApproved,
      isActive,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { deletedAt: null };

    if (role) query.role = role;
    if (isApproved !== undefined) query.isApproved = isApproved === "true";
    if (isActive !== undefined) query.isActive = isActive === "true";

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const users = await User.find(query)
      .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
      .populate("approvedBy", "fullName email")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

/**
 * Get user by ID
 */
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
      .populate("approvedBy", "fullName email")
      .populate("createdBy", "fullName email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get additional profile data based on role
    let profile = null;
    if (user.role === "supplier") {
      profile = await SupplierProfile.findOne({ user: user._id });
    } else if (user.role === "buyer") {
      profile = await BuyerProfile.findOne({ user: user._id });
    }

    res.status(200).json({
      success: true,
      user,
      profile,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
};

/**
 * Approve user (supplier or buyer)
 */
exports.approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: "User is already approved",
      });
    }

    user.isApproved = true;
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    await user.save();

    // Update profile based on role
    if (user.role === "supplier") {
      await SupplierProfile.findOneAndUpdate({ user: user._id }, { kycStatus: "approved" });
    } else if (user.role === "buyer") {
      await BuyerProfile.findOneAndUpdate({ user: user._id }, { kycStatus: "approved" });
    }

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "USER_APPROVE",
      module: "users",
      entityId: user._id,
      entityType: "User",
      details: { approvedBy: req.user.id, notes },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notification
    await NotificationService.send(user._id, {
      title: "Account Approved",
      message: `Your account has been approved by ${req.user.fullName}. You can now access all features.`,
      type: "system",
      priority: "high",
      actionUrl: "/dashboard",
      actionLabel: "Go to Dashboard",
    });

    res.status(200).json({
      success: true,
      message: "User approved successfully",
      user,
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve user",
      error: error.message,
    });
  }
};

/**
 * Reject user (supplier or buyer)
 */
exports.rejectUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: "User is already approved",
      });
    }

    // Update profile based on role
    if (user.role === "supplier") {
      await SupplierProfile.findOneAndUpdate(
        { user: user._id },
        {
          kycStatus: "rejected",
          rejectionReason: reason,
        }
      );
    } else if (user.role === "buyer") {
      await BuyerProfile.findOneAndUpdate(
        { user: user._id },
        {
          kycStatus: "rejected",
          rejectionReason: reason,
        }
      );
    }

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "USER_REJECT",
      module: "users",
      entityId: user._id,
      entityType: "User",
      details: { rejectedBy: req.user.id, reason },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notification
    await NotificationService.send(user._id, {
      title: "Account Rejected",
      message: `Your account has been rejected. Reason: ${reason}`,
      type: "system",
      priority: "high",
    });

    res.status(200).json({
      success: true,
      message: "User rejected successfully",
    });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject user",
      error: error.message,
    });
  }
};

/**
 * Suspend user
 */
exports.suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Suspension reason is required",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: "User is already suspended",
      });
    }

    user.isActive = false;
    await user.save();

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "USER_SUSPEND",
      module: "users",
      entityId: user._id,
      entityType: "User",
      details: { suspendedBy: req.user.id, reason },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notification
    await NotificationService.send(user._id, {
      title: "Account Suspended",
      message: `Your account has been suspended. Reason: ${reason}. Please contact support for more information.`,
      type: "system",
      priority: "high",
    });

    res.status(200).json({
      success: true,
      message: "User suspended successfully",
    });
  } catch (error) {
    console.error("Suspend user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to suspend user",
      error: error.message,
    });
  }
};

/**
 * Activate user (unsuspend)
 */
exports.activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isActive) {
      return res.status(400).json({
        success: false,
        message: "User is already active",
      });
    }

    user.isActive = true;
    await user.save();

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "USER_ACTIVATE",
      module: "users",
      entityId: user._id,
      entityType: "User",
      details: { activatedBy: req.user.id },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notification
    await NotificationService.send(user._id, {
      title: "Account Activated",
      message: `Your account has been reactivated by ${req.user.fullName}.`,
      type: "system",
      priority: "high",
    });

    res.status(200).json({
      success: true,
      message: "User activated successfully",
    });
  } catch (error) {
    console.error("Activate user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to activate user",
      error: error.message,
    });
  }
};

/**
 * Create staff user (admin only)
 */
exports.createStaffUser = async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    // Validate
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Only allow creating staff or admin
    const allowedRoles = ["staff", "admin"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${allowedRoles.join(", ")}`,
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      phone: phone || "",
      password: hashedPassword,
      role: role || "staff",
      isVerified: true,
      isApproved: true,
      createdBy: req.user.id,
    });

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "USER_CREATE",
      module: "users",
      entityId: user._id,
      entityType: "User",
      details: { createdBy: req.user.id, role: user.role },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notification
    await NotificationService.send(user._id, {
      title: "Welcome to AMIRSAD Gold Platform",
      message: `Your staff account has been created by ${req.user.fullName}. You can now login using your email and password.`,
      type: "system",
      priority: "high",
      actionUrl: "/login",
      actionLabel: "Login Now",
    });

    res.status(201).json({
      success: true,
      message: "Staff user created successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Create staff user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create staff user",
      error: error.message,
    });
  }
};

/**
 * Delete user (soft delete)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting self
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    user.deletedAt = new Date();
    user.isActive = false;
    await user.save();

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "USER_DELETE",
      module: "users",
      entityId: user._id,
      entityType: "User",
      details: { deletedBy: req.user.id },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

/**
 * Get user statistics
 */
exports.getUserStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalSuppliers,
      totalBuyers,
      totalStaff,
      totalAdmins,
      pendingApprovals,
      activeUsers,
      suspendedUsers,
    ] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({ role: "supplier", deletedAt: null }),
      User.countDocuments({ role: "buyer", deletedAt: null }),
      User.countDocuments({ role: "staff", deletedAt: null }),
      User.countDocuments({ role: "admin", deletedAt: null }),
      User.countDocuments({ isApproved: false, isActive: true, deletedAt: null }),
      User.countDocuments({ isActive: true, deletedAt: null }),
      User.countDocuments({ isActive: false, deletedAt: null }),
    ]);

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      deletedAt: null,
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalSuppliers,
        totalBuyers,
        totalStaff,
        totalAdmins,
        pendingApprovals,
        activeUsers,
        suspendedUsers,
        recentRegistrations,
      },
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
      error: error.message,
    });
  }
};

/**
 * Get all suppliers with filtering and pagination
 */
exports.getAllSuppliers = async (req, res) => {
  try {
    const {
      isApproved,
      isActive,
      kycStatus,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // First, get all users with role 'supplier'
    const userQuery = {
      role: "supplier",
      deletedAt: null,
    };

    if (isApproved !== undefined) userQuery.isApproved = isApproved === "true";
    if (isActive !== undefined) userQuery.isActive = isActive === "true";

    if (search) {
      userQuery.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get users
    const users = await User.find(userQuery)
      .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
      .populate("approvedBy", "fullName email")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(userQuery);

    // Get supplier profiles for these users
    const userIds = users.map((u) => u._id);
    const profiles = await SupplierProfile.find({
      user: { $in: userIds },
    });

    // Combine user and profile data
    const suppliers = users.map((user) => {
      const profile = profiles.find((p) => p.user.toString() === user._id.toString());
      return {
        ...user.toObject(),
        profile: profile || null,
        kycStatus: profile?.kycStatus || "not_submitted",
      };
    });

    res.status(200).json({
      success: true,
      suppliers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get all suppliers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch suppliers",
      error: error.message,
    });
  }
};

/**
 * Get all buyers with filtering and pagination
 */
exports.getAllBuyers = async (req, res) => {
  try {
    const {
      isApproved,
      isActive,
      kycStatus,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // First, get all users with role 'buyer'
    const userQuery = {
      role: "buyer",
      deletedAt: null,
    };

    if (isApproved !== undefined) userQuery.isApproved = isApproved === "true";
    if (isActive !== undefined) userQuery.isActive = isActive === "true";

    if (search) {
      userQuery.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get users
    const users = await User.find(userQuery)
      .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
      .populate("approvedBy", "fullName email")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(userQuery);

    // Get buyer profiles for these users
    const userIds = users.map((u) => u._id);
    const profiles = await BuyerProfile.find({
      user: { $in: userIds },
    });

    // Combine user and profile data
    const buyers = users.map((user) => {
      const profile = profiles.find((p) => p.user.toString() === user._id.toString());
      return {
        ...user.toObject(),
        profile: profile || null,
        kycStatus: profile?.kycStatus || "not_submitted",
      };
    });

    res.status(200).json({
      success: true,
      buyers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get all buyers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyers",
      error: error.message,
    });
  }
};

/**
 * Get supplier by ID with full details
 */
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user
    const user = await User.findById(id)
      .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
      .populate("approvedBy", "fullName email")
      .populate("createdBy", "fullName email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    if (user.role !== "supplier") {
      return res.status(400).json({
        success: false,
        message: "User is not a supplier",
      });
    }

    // Get supplier profile
    const profile = await SupplierProfile.findOne({ user: user._id });

    // Get statistics for this supplier
    const [opportunityCount, inventoryCount, rfqCount, appointmentCount, dealCount] =
      await Promise.all([
        Opportunity.countDocuments({ supplier: user._id }),
        Inventory.countDocuments({ supplier: user._id, isActive: true }),
        RFQ.countDocuments({ supplier: user._id }),
        Appointment.countDocuments({ supplier: user._id }),
        Deal.countDocuments({ supplier: user._id }),
      ]);

    res.status(200).json({
      success: true,
      supplier: {
        ...user.toObject(),
        profile: profile || null,
        stats: {
          opportunities: opportunityCount,
          inventory: inventoryCount,
          rfqs: rfqCount,
          appointments: appointmentCount,
          deals: dealCount,
        },
      },
    });
  } catch (error) {
    console.error("Get supplier by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier",
      error: error.message,
    });
  }
};

/**
 * Get buyer by ID with full details
 */
exports.getBuyerById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user
    const user = await User.findById(id)
      .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
      .populate("approvedBy", "fullName email")
      .populate("createdBy", "fullName email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    if (user.role !== "buyer") {
      return res.status(400).json({
        success: false,
        message: "User is not a buyer",
      });
    }

    // Get buyer profile
    const profile = await BuyerProfile.findOne({ user: user._id });

    // Get statistics for this buyer
    const [rfqCount, appointmentCount, dealCount] = await Promise.all([
      RFQ.countDocuments({ buyer: user._id }),
      Appointment.countDocuments({ buyer: user._id }),
      Deal.countDocuments({ buyer: user._id }),
    ]);

    res.status(200).json({
      success: true,
      buyer: {
        ...user.toObject(),
        profile: profile || null,
        stats: {
          rfqs: rfqCount,
          appointments: appointmentCount,
          deals: dealCount,
        },
      },
    });
  } catch (error) {
    console.error("Get buyer by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyer",
      error: error.message,
    });
  }
};

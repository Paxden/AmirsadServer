const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { generateToken, generateRefreshToken } = require("../utils/jwt");
const emailService = require("../services/email.service");

// Validation helper
const validateRegistration = (fullName, email, phone, password, role) => {
  const errors = [];

  if (!fullName || fullName.trim().length < 2) {
    errors.push("Full name must be at least 2 characters");
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push("Valid email is required");
  }

  if (!phone || phone.trim().length < 10) {
    errors.push("Valid phone number is required");
  }

  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  if (role && !["admin", "staff", "supplier", "buyer"].includes(role)) {
    errors.push("Invalid role specified");
  }

  return errors;
};

/**
 * Register new user
 * Supports: supplier, buyer (admin/staff must be created by existing admin)
 */
const register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      role,
      companyName,
      position,
      businessRegistrationNumber,
    } = req.body;

    // 1. Validate input
    const validationErrors = validateRegistration(
      fullName,
      email,
      phone,
      password,
      role,
    );
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
        code: "VALIDATION_ERROR",
      });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      let message = "User already exists";
      if (existingUser.email === email) {
        message = "Email already registered";
      } else if (existingUser.phone === phone) {
        message = "Phone number already registered";
      }

      return res.status(400).json({
        success: false,
        message,
        code: "USER_EXISTS",
      });
    }

    // 3. Prevent public registration of admin/staff
    const requestedRole = role || "supplier";
    if (requestedRole === "admin" || requestedRole === "staff") {
      return res.status(403).json({
        success: false,
        message:
          "Admin and staff accounts must be created by system administrator",
        code: "UNAUTHORIZED_ROLE",
      });
    }

    // 4. Hash password with higher salt rounds for security
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 5. Create user with proper structure
    const userData = {
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: requestedRole,
      isVerified: false, // Email verification required
      isApproved: requestedRole === "supplier" ? false : true, // Suppliers need approval
      profile: {
        companyName: companyName || "",
        position: position || "",
      },
    };

    // Add business registration for suppliers
    if (requestedRole === "supplier" && businessRegistrationNumber) {
      userData.kyc = {
        registrationNumber: businessRegistrationNumber,
        verificationStatus: "not_submitted",
      };
    }

    const user = await User.create(userData);

    // 6. Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // 7. Send verification email (best effort - don't fail registration if email fails)
    try {
      await emailService.sendVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    // 8. Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // 9. Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    // 10. Send response (exclude sensitive data)
    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email to continue.",
      token,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isApproved: user.isApproved,
        kycStatus: user.kyc?.verificationStatus,
        profile: user.profile,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again later.",
      code: "REGISTRATION_ERROR",
    });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
        code: "MISSING_CREDENTIALS",
      });
    }

    // Find user
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      deletedAt: null,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log(`Failed login attempt for ${email}`);

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check account status
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    if (user.deletedAt) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated.",
        code: "ACCOUNT_DELETED",
      });
    }

    // Email verification check
    if (
      !user.isVerified &&
      process.env.REQUIRE_EMAIL_VERIFICATION === "true"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email address before logging in.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    // Generate tokens
    const token = generateToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString());

    // Update login info
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    user.lastLoginIP =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress;

    await user.save();

    // User response
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      isApproved: user.isApproved,
      kycStatus: user.kyc?.verificationStatus,
      profile: user.profile,
      createdAt: user.createdAt,
    };

    const warnings = [];

    if (!user.isApproved && user.role === "supplier") {
      warnings.push(
        "Your account is pending approval. You'll be notified once approved."
      );
    }

    if (user.kyc?.verificationStatus === "pending") {
      warnings.push(
        "Your KYC is under review. Some features may be limited until approved."
      );
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      user: userResponse,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed. Please try again later.",
      code: "LOGIN_ERROR",
    });
  }
};

/**
 * Get current user profile
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select(
        "-password -refreshToken -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires"
      )
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    const warnings = [];

    if (!user.isApproved && user.role === "supplier") {
      warnings.push("Your account is pending approval");
    }

    if (user.kyc?.verificationStatus === "pending") {
      warnings.push("Your KYC is under review");
    }

    if (!user.isVerified) {
      warnings.push("Please verify your email address");
    }

    res.status(200).json({
      success: true,
      user,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (error) {
    console.error("GetMe error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
      code: "GET_USER_ERROR",
    });
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token required",
        code: "REFRESH_TOKEN_REQUIRED",
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    );

    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: refreshToken,
      isActive: true,
      deletedAt: null,
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    // Generate new tokens
    const newToken = generateToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    // Update refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(403).json({
      success: false,
      message: "Invalid or expired refresh token",
      code: "REFRESH_TOKEN_ERROR",
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    // Clear refresh token from database
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, {
        refreshToken: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
        code: "INVALID_TOKEN",
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
    });
  }
};

/**
 * Resend verification email
 */
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
        code: "ALREADY_VERIFIED",
      });
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    // Send email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: "Verify your email - AMIRSAD Gold Platform",
      template: "emailVerification",
      data: { name: user.fullName, url: verificationUrl },
    });

    res.status(200).json({
      success: true,
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send verification email",
    });
  }
};

/**
 * Change password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.refreshToken = null; // Invalidate all sessions
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

/**
 * Forgot password - send reset email
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal that user doesn't exist for security
      return res.status(200).json({
        success: true,
        message:
          "If that email is registered, you will receive a password reset link",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send email (optional)
    try {
      const sendEmail = require("../utils/sendEmail");
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      await sendEmail({
        to: user.email,
        subject: "Password Reset - AMIRSAD Gold Platform",
        template: "passwordReset",
        data: { name: user.fullName, url: resetUrl },
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }

    res.status(200).json({
      success: true,
      message:
        "If that email is registered, you will receive a password reset link",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
    });
  }
};

/**
 * Reset password with token
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
        code: "INVALID_TOKEN",
      });
    }

    // Update password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    user.password = await bcrypt.hash(password, saltRounds);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = null; // Invalidate all sessions
    await user.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      "fullName",
      "phone",
      "profile.companyName",
      "profile.position",
      "profile.address",
      "profile.website",
      "profile.logo",
      "settings.emailNotifications",
      "settings.smsNotifications",
      "settings.language",
      "settings.timezone",
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        if (key.includes(".")) {
          const [parent, child] = key.split(".");
          if (!updates[parent]) updates[parent] = {};
          updates[parent][child] = req.body[key];
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password -refreshToken");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

/**
 * Get all users (Admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, isApproved, page = 1, limit = 10 } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isApproved !== undefined) query.isApproved = isApproved === "true";

    const users = await User.find(query)
      .select("-password -refreshToken")
      .sort("-createdAt")
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
    });
  }
};

/**
 * Get user by ID (Admin/Staff)
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "-password -refreshToken",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

/**
 * Approve user (Admin/Staff)
 */
const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isApproved: true,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // TODO: Send approval notification email

    res.status(200).json({
      success: true,
      message: `User ${user.fullName} has been approved`,
      user,
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve user",
    });
  }
};

/**
 * Suspend user (Admin only)
 */
const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isActive: false,
        // Add suspension reason to a new field if needed
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${user.fullName} has been suspended`,
      user,
    });
  } catch (error) {
    console.error("Suspend user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to suspend user",
    });
  }
};

/**
 * Delete user (Admin only - soft delete)
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        deletedAt: new Date(),
        isActive: false,
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${user.fullName} has been deleted`,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

/**
 * Get pending approvals (Admin/Staff)
 */
const getPendingApprovals = async (req, res) => {
  try {
    const pendingSuppliers = await User.find({
      role: "supplier",
      isApproved: false,
      deletedAt: null,
    }).select("-password -refreshToken");

    const pendingKYC = await User.find({
      role: "supplier",
      "kyc.verificationStatus": "pending",
      deletedAt: null,
    }).select("-password -refreshToken");

    res.status(200).json({
      success: true,
      pendingSuppliers,
      pendingKYC,
    });
  } catch (error) {
    console.error("Get pending approvals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending approvals",
    });
  }
};

/**
 * Get KYC submissions (Admin/Staff)
 */
const getKYCSubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      role: "supplier",
      "kyc.verificationStatus": status || { $ne: "not_submitted" },
    };

    const submissions = await User.find(query)
      .select("fullName email phone kyc createdAt")
      .sort("-kyc.updatedAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.status(200).json({
      success: true,
      submissions,
    });
  } catch (error) {
    console.error("Get KYC submissions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch KYC submissions",
    });
  }
};

/**
 * Get supplier stats (Supplier only)
 */
const getSupplierStats = async (req, res) => {
  try {
    // This will be implemented when we create the Opportunity model
    res.status(200).json({
      success: true,
      stats: {
        totalOpportunities: 0,
        activeOpportunities: 0,
        soldGold: 0,
        pendingApprovals: 0,
      },
    });
  } catch (error) {
    console.error("Get supplier stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
    });
  }
};

/**
 * Get buyer stats (Buyer only)
 */
const getBuyerStats = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      stats: {
        totalQuotations: 0,
        pendingAppointments: 0,
        purchasedGold: 0,
      },
    });
  } catch (error) {
    console.error("Get buyer stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
    });
  }
};

/**
 * Get supplier opportunities (Supplier only)
 */
const getSupplierOpportunities = async (req, res) => {
  try {
    // This will be implemented when we create the Opportunity model
    res.status(200).json({
      success: true,
      opportunities: [],
    });
  } catch (error) {
    console.error("Get supplier opportunities error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch opportunities",
    });
  }
};

/**
 * Get available inventory (Buyer only)
 */
const getAvailableInventory = async (req, res) => {
  try {
    // This will be implemented when we create the Inventory model
    res.status(200).json({
      success: true,
      inventory: [],
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  refreshToken,
  logout,
  verifyEmail,
  resendVerificationEmail,
  changePassword,
  forgotPassword,
  resetPassword,
  updateProfile,
  getAllUsers,
  getUserById,
  approveUser,
  suspendUser,
  deleteUser,
  getPendingApprovals,
  getKYCSubmissions,
  getSupplierStats,
  getBuyerStats,
  getSupplierOpportunities,
  getAvailableInventory,
};

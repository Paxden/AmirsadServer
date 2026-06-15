const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect middleware - Authentication & Authorization
 * Checks: Valid token, user exists, account active, email verified
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // 1. Extract token from header or cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Optional: Support cookie-based auth for web portal
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login first.",
        code: "NO_TOKEN",
      });
    }

    // 3. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Handle specific JWT errors
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
          code: "TOKEN_EXPIRED",
        });
      }
      if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
          code: "INVALID_TOKEN",
        });
      }
      throw jwtError;
    }

    // 4. Check if user still exists in database
    const user = await User.findById(decoded.id)
      .select("+password") // Only if needed for additional checks
      .lean(); // Use lean() for better performance

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists. Please contact support.",
        code: "USER_NOT_FOUND",
      });
    }

    // 5. Check if account is active (not suspended)
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    // 6. Check if account is deleted (soft delete)
    if (user.deletedAt) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated.",
        code: "ACCOUNT_DELETED",
      });
    }

    // 7. Optional: Check if email is verified (can skip for some routes)
    // Add this to routes that require verified email only
    if (req.requireEmailVerification && !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email address first.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // 8. Optional: Check if user is approved (for suppliers/buyers)
    // Add this for sensitive operations
    if (req.requireApproval && !user.isApproved && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval by AMIRSAD staff.",
        code: "ACCOUNT_PENDING_APPROVAL",
      });
    }

    // 9. Update last login activity (async - don't await to avoid blocking)
    User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      lastLoginIP: req.ip || req.connection.remoteAddress,
    }).catch((err) => console.error("Failed to update last login:", err));

    // 10. Attach user to request
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    req.token = token; // Store token for logout purposes

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
      code: "AUTH_ERROR",
    });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Ensure protect middleware ran first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Please login first.",
        code: "NOT_AUTHENTICATED",
      });
    }

    // Check if user's role is allowed
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role} role does not have permission. Required roles: ${roles.join(", ")}`,
        code: "INSUFFICIENT_PERMISSIONS",
        requiredRoles: roles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

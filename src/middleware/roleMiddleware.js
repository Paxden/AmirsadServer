/**
 * Authorize middleware - Role-based access control
 * Supports single role, multiple roles, and role hierarchy
 * @param  {...String} roles - Allowed roles (admin, staff, supplier, buyer)
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Ensure user exists (should be set by protect middleware)
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userRole = req.user.role;

    // Role hierarchy (higher privilege roles can access lower privilege routes)
    const roleHierarchy = {
      admin: 4,
      staff: 3,
      buyer: 2,
      supplier: 1,
    };

    // Check if user has required role
    let hasAccess = false;

    // If using role hierarchy (admin can access staff routes, etc.)
    const useHierarchy = process.env.USE_ROLE_HIERARCHY === "true";

    if (useHierarchy) {
      // Get highest required role level
      const maxRequiredLevel = Math.max(
        ...roles.map((role) => roleHierarchy[role] || 0),
      );
      const userLevel = roleHierarchy[userRole] || 0;
      hasAccess = userLevel >= maxRequiredLevel;
    } else {
      // Exact role matching
      hasAccess = roles.includes(userRole);
    }

    if (!hasAccess) {
      // Generate helpful error message based on roles
      let message = "Access denied";
      let suggestion = "";

      if (roles.length === 1) {
        message = `Access denied. This action requires ${roles[0]} privileges.`;
        suggestion = `Your role is ${userRole}. Please contact support if you need access.`;
      } else {
        const roleList = roles.join(" or ");
        message = `Access denied. This action requires ${roleList} privileges.`;
        suggestion = `Your role is ${userRole}. Please contact support if you need access.`;
      }

      // Special messages for common scenarios
      if (userRole === "supplier" && roles.includes("buyer")) {
        suggestion =
          "Suppliers cannot access buyer-only features. Please register as a buyer if needed.";
      } else if (userRole === "buyer" && roles.includes("supplier")) {
        suggestion = "Buyers cannot access supplier-only features.";
      } else if (userRole === "staff" && roles.includes("admin")) {
        suggestion =
          "This action requires admin privileges. Please contact a system administrator.";
      }

      return res.status(403).json({
        success: false,
        message,
        suggestion,
        code: "FORBIDDEN_ROLE",
        requiredRoles: roles,
        userRole: userRole,
        timestamp: new Date().toISOString(),
      });
    }

    // Log access for audit (optional - can be async)
    if (process.env.LOG_ACCESS_CONTROL === "true") {
      console.log(
        `[ACCESS] User ${req.user._id} (${userRole}) accessed ${req.method} ${req.originalUrl}`,
      );
    }

    next();
  };
};

// Pre-defined role combinations for common use cases
exports.authorizeRoles = {
  // Only admins
  adminOnly: () => exports.authorize("admin"),

  // Admin and staff (internal users)
  internalOnly: () => exports.authorize("admin", "staff"),

  // Suppliers only
  suppliersOnly: () => exports.authorize("supplier"),

  // Buyers only
  buyersOnly: () => exports.authorize("buyer"),

  // Suppliers and buyers (external users)
  externalUsers: () => exports.authorize("supplier", "buyer"),

  // All authenticated users
  allAuthenticated: () =>
    exports.authorize("admin", "staff", "supplier", "buyer"),

  // KYC verified suppliers only (combine with hasCompletedKYC middleware)
  verifiedSuppliersOnly: () => [
    exports.authorize("supplier"),
    require("./auth").hasCompletedKYC,
  ],
};

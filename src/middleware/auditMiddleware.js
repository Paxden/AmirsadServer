const AuditLog = require("../models/AuditLog");
const { v4: uuidv4 } = require("uuid");

// Generate unique request ID
const generateRequestId = () => {
  return uuidv4();
};

// Main audit middleware
exports.audit = (module, action, options = {}) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    const requestId = generateRequestId();

    // Store original send function
    const originalSend = res.json;
    let responseBody = null;

    // Override send to capture response
    res.json = function (body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Capture request details
    const auditData = {
      user: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action,
      module,
      entityId: req.params.id || req.body?.id,
      entityType: options.entityType,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      requestId,
      sessionId: req.session?.id,
      details: {
        method: req.method,
        url: req.originalUrl,
        query: req.query,
        body: options.sensitive ? undefined : req.body,
        params: req.params,
      },
      location: req.location || {},
      metadata: options.metadata || {},
    };

    // Store before state if entity ID provided and it's an update
    if (options.entityType && req.params.id && options.captureBefore) {
      try {
        const Model = require(`../models/${options.entityType}`);
        const entity = await Model.findById(req.params.id).lean();
        auditData.before = entity;
      } catch (error) {
        console.error("Failed to capture before state:", error);
      }
    }

    // Attach audit data to request for later use
    req.audit = auditData;
    req.startTime = startTime;

    next();
  };
};

// After request middleware to finalize audit
exports.finalizeAudit = async (req, res, next) => {
  // Wait for response to finish
  res.on("finish", async () => {
    if (req.audit) {
      const duration = Date.now() - req.startTime;

      // Determine status based on response
      const status = res.statusCode >= 400 ? "failure" : "success";

      // Capture after state if needed
      if (req.audit.before && req.audit.entityId) {
        try {
          const Model = require(`../models/${req.audit.entityType}`);
          const entity = await Model.findById(req.audit.entityId).lean();
          req.audit.after = entity;
        } catch (error) {
          console.error("Failed to capture after state:", error);
        }
      }

      // Add error message if failed
      if (status === "failure" && res.locals.errorMessage) {
        req.audit.errorMessage = res.locals.errorMessage;
      }

      // Complete audit log
      req.audit.status = status;
      req.audit.duration = duration;
      req.audit.details.statusCode = res.statusCode;

      // Save audit log asynchronously (don't await to avoid blocking)
      AuditLog.log(req.audit).catch((error) => {
        console.error("Failed to save audit log:", error);
      });
    }
  });

  next();
};

// Specific audit middleware for common actions
exports.auditCreate = (module, entityType) => {
  return exports.audit(module, `${entityType.toUpperCase()}_CREATE`, {
    entityType,
    captureBefore: false,
  });
};

exports.auditUpdate = (module, entityType) => {
  return exports.audit(module, `${entityType.toUpperCase()}_UPDATE`, {
    entityType,
    captureBefore: true,
  });
};

exports.auditDelete = (module, entityType) => {
  return exports.audit(module, `${entityType.toUpperCase()}_DELETE`, {
    entityType,
    captureBefore: true,
  });
};

exports.auditApprove = (module, entityType) => {
  return exports.audit(module, `${entityType.toUpperCase()}_APPROVE`, {
    entityType,
    captureBefore: true,
  });
};

// User action audit
exports.auditUserAction = (action) => {
  return exports.audit("users", action, { entityType: "User" });
};

// System action audit
exports.auditSystem = (action, metadata = {}) => {
  return exports.audit("system", action, { metadata });
};

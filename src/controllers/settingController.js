const SystemSetting = require("../models/SystemSetting");
const AuditLog = require("../models/AuditLog");

// Default settings to seed if none exist
const defaultSettings = {
  // General Settings
  company_name: {
    value: "AMIRSAD ENERGY CONSULT",
    category: "general",
    description: "Company name displayed throughout the system",
    isEditable: true,
  },
  company_email: {
    value: "support@amirsad.com",
    category: "general",
    description: "Support email address",
    isEditable: true,
  },
  company_phone: {
    value: "+234123456789",
    category: "general",
    description: "Support phone number",
    isEditable: true,
  },
  company_address: {
    value: "Lagos, Nigeria",
    category: "general",
    description: "Company physical address",
    isEditable: true,
  },
  company_logo: {
    value: "",
    category: "general",
    description: "Company logo URL",
    isEditable: true,
  },

  // RFQ Settings
  rfq_expiry_days: {
    value: 7,
    category: "rfq",
    description: "Number of days until RFQ expires",
    isEditable: true,
  },
  rfq_auto_approve_limit: {
    value: 50000,
    category: "rfq",
    description: "Auto-approve RFQs below this amount",
    isEditable: true,
  },
  rfq_notification_staff: {
    value: true,
    category: "rfq",
    description: "Notify staff when new RFQ is created",
    isEditable: true,
  },

  // Appointment Settings
  appointment_duration: {
    value: 60,
    category: "appointment",
    description: "Default appointment duration in minutes",
    isEditable: true,
  },
  appointment_reminder_hours: {
    value: 24,
    category: "appointment",
    description: "Hours before appointment to send reminder",
    isEditable: true,
  },
  appointment_max_future_days: {
    value: 90,
    category: "appointment",
    description: "Maximum days in advance to schedule appointments",
    isEditable: true,
  },

  // Notification Settings
  notification_email_enabled: {
    value: true,
    category: "notification",
    description: "Enable email notifications",
    isEditable: true,
  },
  notification_sms_enabled: {
    value: false,
    category: "notification",
    description: "Enable SMS notifications",
    isEditable: true,
  },
  notification_push_enabled: {
    value: true,
    category: "notification",
    description: "Enable push notifications",
    isEditable: true,
  },

  // Currency Settings
  base_currency: {
    value: "USD",
    category: "currencies",
    description: "Base currency for all transactions",
    isEditable: true,
  },
  supported_currencies: {
    value: ["USD", "EUR", "GBP", "AED"],
    category: "currencies",
    description: "List of supported currencies",
    isEditable: true,
  },

  // Security Settings
  session_timeout_minutes: {
    value: 120,
    category: "security",
    description: "User session timeout in minutes",
    isEditable: true,
  },
  max_login_attempts: {
    value: 5,
    category: "security",
    description: "Maximum failed login attempts before lockout",
    isEditable: true,
  },
  password_expiry_days: {
    value: 90,
    category: "security",
    description: "Password expiry in days",
    isEditable: true,
  },
};

/**
 * Initialize default settings (call this on server start)
 */
exports.initSettings = async () => {
  try {
    for (const [key, data] of Object.entries(defaultSettings)) {
      await SystemSetting.findOneAndUpdate(
        { key },
        {
          key,
          value: data.value,
          category: data.category,
          description: data.description,
          isEditable: data.isEditable,
        },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Default system settings initialized");
  } catch (error) {
    console.error("Error initializing settings:", error);
  }
};

/**
 * Get all settings
 */
exports.getAllSettings = async (req, res) => {
  try {
    const { category } = req.query;

    let query = {};
    if (category) query.category = category;

    const settings = await SystemSetting.find(query).sort("category key");

    res.status(200).json({
      success: true,
      count: settings.length,
      settings,
    });
  } catch (error) {
    console.error("Get all settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

/**
 * Get setting by key
 */
exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await SystemSetting.findOne({ key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting '${key}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      setting,
    });
  } catch (error) {
    console.error("Get setting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch setting",
      error: error.message,
    });
  }
};

/**
 * Update single setting
 */
exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const setting = await SystemSetting.findOne({ key });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting '${key}' not found`,
      });
    }

    if (!setting.isEditable) {
      return res.status(403).json({
        success: false,
        message: `Setting '${key}' is not editable`,
      });
    }

    const oldValue = setting.value;
    setting.value = value;
    setting.lastModifiedBy = req.user.id;
    await setting.save();

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "SETTINGS_UPDATE",
      module: "settings",
      details: { key, oldValue, newValue: value },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Setting updated successfully",
      setting,
    });
  } catch (error) {
    console.error("Update setting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update setting",
      error: error.message,
    });
  }
};

/**
 * Bulk update settings
 */
exports.bulkUpdateSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid settings object",
      });
    }

    const updates = [];
    const errors = [];

    for (const [key, value] of Object.entries(settings)) {
      try {
        const setting = await SystemSetting.findOne({ key });

        if (!setting) {
          errors.push({ key, error: "Setting not found" });
          continue;
        }

        if (!setting.isEditable) {
          errors.push({ key, error: "Setting not editable" });
          continue;
        }

        const oldValue = setting.value;
        setting.value = value;
        setting.lastModifiedBy = req.user.id;
        await setting.save();

        updates.push({ key, oldValue, newValue: value });
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    }

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "SETTINGS_UPDATE",
      module: "settings",
      details: { bulkUpdate: true, updates, errors },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: `Updated ${updates.length} settings, ${errors.length} errors`,
      updates,
      errors,
    });
  } catch (error) {
    console.error("Bulk update settings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};

/**
 * Get setting value helper (for other controllers)
 */
exports.getSettingValue = async (key, defaultValue = null) => {
  try {
    const setting = await SystemSetting.findOne({ key });
    return setting ? setting.value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Reset setting to default
 */
exports.resetSetting = async (req, res) => {
  try {
    const { key } = req.params;

    const defaultSetting = defaultSettings[key];
    if (!defaultSetting) {
      return res.status(404).json({
        success: false,
        message: `No default value for setting '${key}'`,
      });
    }

    const setting = await SystemSetting.findOne({ key });
    if (!setting) {
      return res.status(404).json({
        success: false,
        message: `Setting '${key}' not found`,
      });
    }

    const oldValue = setting.value;
    setting.value = defaultSetting.value;
    setting.lastModifiedBy = req.user.id;
    await setting.save();

    res.status(200).json({
      success: true,
      message: "Setting reset to default",
      setting,
    });
  } catch (error) {
    console.error("Reset setting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset setting",
    });
  }
};

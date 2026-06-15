const Notification = require("../models/Notification");
const NotificationService = require("../services/notificationService");

/**
 * Get user notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;

    const notifications = await Notification.getUserNotifications(
      req.user.id,
      parseInt(limit),
      parseInt(skip),
    );

    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      hasMore: notifications.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.markAsRead(
      notificationId,
      req.user.id,
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      unreadCount,
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      unreadCount: 0,
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
    });
  }
};

/**
 * Dismiss notification
 */
exports.dismissNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    await Notification.findOneAndUpdate(
      { _id: notificationId, user: req.user.id },
      { isDismissed: true },
    );

    res.status(200).json({
      success: true,
      message: "Notification dismissed",
    });
  } catch (error) {
    console.error("Dismiss notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to dismiss notification",
    });
  }
};

/**
 * Get notification preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    // You can store preferences in User model or separate settings collection
    res.status(200).json({
      success: true,
      preferences: {
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        rfqAlerts: true,
        inventoryAlerts: true,
        appointmentReminders: true,
        kycUpdates: true,
      },
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch preferences",
    });
  }
};

/**
 * Update notification preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const preferences = req.body;
    // Store preferences in database
    res.status(200).json({
      success: true,
      message: "Preferences updated",
      preferences,
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update preferences",
    });
  }
};

/**
 * Test notification (for development)
 */
exports.testNotification = async (req, res) => {
  try {
    await NotificationService.send(req.user.id, {
      title: "Test Notification",
      message: "This is a test notification to verify the system is working",
      type: "system",
      priority: "normal",
      icon: "bell",
      color: "info",
    });

    res.status(200).json({
      success: true,
      message: "Test notification sent",
    });
  } catch (error) {
    console.error("Test notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test notification",
    });
  }
};

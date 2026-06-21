const Notification = require("../models/Notification");
const Message = require("../models/Message");
const User = require("../models/User");
const { getIO } = require("./socketService");

class NotificationService {
  /**
   * Send notification to user
   */
  static async send(userId, notificationData) {
    try {
      // Create notification in database
      const notification = await Notification.create({
        user: userId,
        ...notificationData,
      });

      // Get user for real-time update
      const user = await User.findById(userId).select("fullName email phone");

      // Emit socket event for real-time update
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit("new_notification", {
          notification,
          unreadCount: await Notification.getUnreadCount(userId),
        });
      }

      // Send email if required
      if (notificationData.sendEmail && user.email) {
        await this.sendEmail(user.email, notificationData);
      }

      // Send SMS if required
      if (notificationData.sendSms && user.phone) {
        await this.sendSMS(user.phone, notificationData);
      }

      return notification;
    } catch (error) {
      console.error("Send notification error:", error);
      return null;
    }
  }

  /**
   * Send bulk notifications
   */
  static async sendBulk(userIds, notificationData) {
    const promises = userIds.map(userId => this.send(userId, notificationData));
    return Promise.all(promises);
  }

  /**
   * Send notification for RFQ event
   */
  static async forRFQ(rfq, event, userIds) {
    const templates = {
      created: {
        title: "New RFQ Created",
        message: `RFQ ${rfq.rfqNumber} has been created for ${rfq.requestedWeightKg}kg of gold`,
        type: "rfq",
        priority: "high",
        icon: "file-text",
        color: "info",
      },
      quoted: {
        title: "Quote Received",
        message: `You've received a quote for RFQ ${rfq.rfqNumber}`,
        type: "rfq",
        priority: "high",
        icon: "dollar-sign",
        color: "success",
      },
      accepted: {
        title: "RFQ Accepted",
        message: `RFQ ${rfq.rfqNumber} has been accepted`,
        type: "rfq",
        priority: "high",
        icon: "check-circle",
        color: "success",
      },
      rejected: {
        title: "RFQ Update",
        message: `RFQ ${rfq.rfqNumber} has been updated`,
        type: "rfq",
        priority: "normal",
        icon: "x-circle",
        color: "danger",
      },
    };

    const template = templates[event];
    if (!template) return;

    const actionUrl = `/dashboard/rfq/${rfq._id}`;
    
    return this.sendBulk(userIds, {
      ...template,
      relatedType: "rfq",
      relatedId: rfq._id,
      actionUrl,
      actionLabel: "View RFQ",
    });
  }

  /**
   * Send notification for Appointment event
   */
  static async forAppointment(appointment, event, userIds) {
    const templates = {
      created: {
        title: "New Appointment Scheduled",
        message: `Appointment for ${appointment.type} scheduled on ${new Date(appointment.scheduledDate).toLocaleString()}`,
        type: "appointment",
        priority: "high",
        icon: "calendar",
        color: "primary",
      },
      confirmed: {
        title: "Appointment Confirmed",
        message: `Your ${appointment.type} appointment has been confirmed`,
        type: "appointment",
        priority: "high",
        icon: "check-circle",
        color: "success",
      },
      reminder: {
        title: "Appointment Reminder",
        message: `Reminder: Your ${appointment.type} appointment is in 1 hour`,
        type: "reminder",
        priority: "high",
        icon: "clock",
        color: "warning",
      },
      completed: {
        title: "Appointment Completed",
        message: `Your ${appointment.type} appointment has been marked as completed`,
        type: "appointment",
        priority: "normal",
        icon: "check",
        color: "info",
      },
    };

    const template = templates[event];
    if (!template) return;

    const actionUrl = `/dashboard/appointments/${appointment._id}`;
    
    return this.sendBulk(userIds, {
      ...template,
      relatedType: "appointment",
      relatedId: appointment._id,
      actionUrl,
      actionLabel: "View Appointment",
    });
  }

  /**
   * Send notification for KYC event
   */
  static async forKYC(userId, status, notes) {
    const templates = {
      approved: {
        title: "KYC Approved!",
        message: "Your KYC verification has been approved. You can now access all features.",
        type: "kyc",
        priority: "high",
        icon: "check-circle",
        color: "success",
      },
      rejected: {
        title: "KYC Update",
        message: `Your KYC verification was not approved. Reason: ${notes || "Please contact support"}`,
        type: "kyc",
        priority: "high",
        icon: "x-circle",
        color: "danger",
      },
      pending: {
        title: "KYC Submitted",
        message: "Your KYC documents have been submitted and are under review.",
        type: "kyc",
        priority: "normal",
        icon: "clock",
        color: "warning",
      },
    };

    const template = templates[status];
    if (!template) return;

    const actionUrl = "/dashboard/profile/kyc";
    
    return this.send(userId, {
      ...template,
      relatedType: "kyc",
      actionUrl,
      actionLabel: "View Status",
    });
  }

  /**
   * Send notification for Inventory event
   */
  static async forInventory(inventory, event, userIds) {
    const templates = {
      approved: {
        title: "Inventory Approved",
        message: `Your gold inventory (${inventory.weightKg}kg, ${inventory.purity}% purity) has been approved`,
        type: "inventory",
        priority: "high",
        icon: "check-circle",
        color: "success",
      },
      available: {
        title: "New Gold Available",
        message: `${inventory.weightKg}kg of ${inventory.purity}% purity gold is now available at $${inventory.askingPrice}/kg`,
        type: "inventory",
        priority: "high",
        icon: "package",
        color: "info",
      },
      sold: {
        title: "Gold Sold",
        message: `Your gold inventory (${inventory.weightKg}kg) has been sold`,
        type: "inventory",
        priority: "high",
        icon: "truck",
        color: "success",
      },
    };

    const template = templates[event];
    if (!template) return;

    const actionUrl = `/dashboard/inventory/${inventory._id}`;
    
    return this.sendBulk(userIds, {
      ...template,
      relatedType: "inventory",
      relatedId: inventory._id,
      actionUrl,
      actionLabel: "View Inventory",
    });
  }

  /**
   * Send email notification
   */
  static async sendEmail(email, data) {
    try {
      // Integrate with your email service (nodemailer, sendgrid, etc.)
      console.log(`Email sent to ${email}: ${data.title} - ${data.message}`);
      // Implement actual email sending here
      return true;
    } catch (error) {
      console.error("Send email error:", error);
      return false;
    }
  }

  /**
   * Send SMS notification
   */
  static async sendSMS(phone, data) {
    try {
      // Integrate with your SMS service (twilio, etc.)
      console.log(`SMS sent to ${phone}: ${data.title} - ${data.message}`);
      // Implement actual SMS sending here
      return true;
    } catch (error) {
      console.error("Send SMS error:", error);
      return false;
    }
  }

  /**
   * Create system notification for multiple users
   */
  static async systemNotification(userIds, title, message, priority = "normal") {
    return this.sendBulk(userIds, {
      title,
      message,
      type: "system",
      priority,
      icon: "bell",
      color: "primary",
    });
  }
}

module.exports = NotificationService;
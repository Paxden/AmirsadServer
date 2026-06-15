const cron = require("node-cron");
const RFQ = require("../models/RFQ");
const Inventory = require("../models/Inventory");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");

/**
 * Expire old RFQs
 */
const expireRFQs = async () => {
  try {
    console.log("Running RFQ expiry job...");

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - 7); // 7 days expiry

    const result = await RFQ.updateMany(
      {
        status: "pending",
        createdAt: { $lt: expiryDate },
        isActive: true,
      },
      {
        status: "expired",
      }
    );

    console.log(`Expired ${result.modifiedCount} RFQs`);
  } catch (error) {
    console.error("RFQ expiry job error:", error);
  }
};

/**
 * Update inventory expiry status
 */
const updateInventoryExpiry = async () => {
  try {
    console.log("Running inventory expiry job...");

    const result = await Inventory.updateMany(
      {
        availableUntil: { $lt: new Date() },
        status: "available",
        isActive: true,
      },
      {
        isExpired: true,
        status: "archived",
      }
    );

    console.log(`Expired ${result.modifiedCount} inventory items`);
  } catch (error) {
    console.error("Inventory expiry job error:", error);
  }
};

/**
 * Send appointment reminders
 */
const sendAppointmentReminders = async () => {
  try {
    console.log("Running appointment reminder job...");

    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + 24); // 24 hours before

    const appointments = await Appointment.find({
      scheduledDate: {
        $gte: new Date(),
        $lte: reminderTime,
      },
      status: "confirmed",
    }).populate("supplier buyer");

    for (const appointment of appointments) {
      // Send reminders (implement notification logic)
      console.log(`Reminder for appointment: ${appointment._id}`);
    }

    console.log(`Processed ${appointments.length} appointment reminders`);
  } catch (error) {
    console.error("Appointment reminder job error:", error);
  }
};

/**
 * Clean up old notifications
 */
const cleanupNotifications = async () => {
  try {
    console.log("Running notification cleanup...");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Notification.deleteMany({
      isRead: true,
      createdAt: { $lt: thirtyDaysAgo },
    });

    console.log(`Cleaned up ${result.deletedCount} old notifications`);
  } catch (error) {
    console.error("Notification cleanup error:", error);
  }
};

/**
 * Initialize all cron jobs
 */
const initializeJobs = () => {
  console.log("Initializing background jobs...");

  // Run every hour
  cron.schedule("0 * * * *", async () => {
    console.log("Hourly jobs running...");
    await updateInventoryExpiry();
  });

  // Run every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    console.log("6-hour jobs running...");
    await expireRFQs();
  });

  // Run daily at 9 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("Daily jobs running...");
    await cleanupNotifications();
  });

  // Run every hour for reminders
  cron.schedule("0 * * * *", async () => {
    console.log("Reminder jobs running...");
    await sendAppointmentReminders();
  });

  console.log("✅ Background jobs initialized");
};

module.exports = { initializeJobs };

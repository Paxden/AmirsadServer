// Load environment variables FIRST
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // Adjust path if needed

const createAdminAndStaff = async () => {
  try {
    // Check if MONGO_URI exists
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }

    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Create Admin User with required fields
    const adminExists = await User.findOne({ email: "admin@amirsad.com" });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("Admin@123456", 12);

      const admin = await User.create({
        fullName: "Super Admin", // Required field
        name: "Super Admin", // If your model also has name field
        email: "admin@amirsad.com",
        password: hashedPassword,
        phone: "+1234567890", // Required field - add a dummy phone number
        role: "admin",
        isVerified: true,
        isActive: true,
      });

      console.log("✅ Admin user created:", admin.email);
      console.log("   Password: Admin@123456");
    } else {
      console.log("⚠️ Admin user already exists");
    }

    // Create Staff User with required fields
    const staffExists = await User.findOne({ email: "staff@amirsad.com" });
    if (!staffExists) {
      const hashedPassword = await bcrypt.hash("Staff@123456", 12);

      const staff = await User.create({
        fullName: "Support Staff", // Required field
        name: "Support Staff", // If your model also has name field
        email: "staff@amirsad.com",
        password: hashedPassword,
        phone: "+1234567891", // Required field - different phone number
        role: "staff",
        isVerified: true,
        isActive: true,
      });

      console.log("✅ Staff user created:", staff.email);
      console.log("   Password: Staff@123456");
    } else {
      console.log("⚠️ Staff user already exists");
    }

    console.log("\n📋 Credentials Summary:");
    console.log("Admin - Email: admin@amirsad.com, Password: Admin@123456");
    console.log("Staff - Email: staff@amirsad.com, Password: Staff@123456");

    process.exit(0);
  } catch (error) {
    console.error("Error creating users:", error);
    process.exit(1);
  }
};

createAdminAndStaff();

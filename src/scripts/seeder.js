/* eslint-disable no-undef */
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../src/models/User");

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to database");

    // Create admin user if not exists
    const adminExists = await User.findOne({ role: "admin" });
    if (!adminExists) {
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("Admin@123", 10);

      await User.create({
        fullName: "Super Admin",
        email: "admin@amirsad.com",
        phone: "+1234567890",
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        isApproved: true,
      });
      console.log("Admin user created");
    }

    console.log("Database seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

const deleteData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to database");

    // Keep admin user only
    await User.deleteMany({ role: { $ne: "admin" } });
    console.log("All non-admin data deleted");

    process.exit(0);
  } catch (error) {
    console.error("Delete error:", error);
    process.exit(1);
  }
};

if (process.argv.includes("--delete")) {
  deleteData();
} else {
  seedDatabase();
}
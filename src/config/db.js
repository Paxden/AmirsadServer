const mongoose = require("mongoose");

/**
 * Establishes connection to MongoDB database
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    // Validate MongoDB URI exists
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    const connection = await mongoose.connect(process.env.MONGO_URI, {
      // Recommended connection options for modern Mongoose versions
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ MongoDB Connected: ${connection.connection.host}:${connection.connection.port}`);
    console.log(`📦 Database: ${connection.connection.name}`);

    // Optional: Listen for connection events
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.error(`❌ MongoDB connection error: ${err.message}`);
    });

  } catch (error) {
    console.error(`❌ Failed to connect to MongoDB: ${error.message}`);
    
    // Graceful shutdown instead of forced exit
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
    
    // In production, throw error to be handled by process managers
    throw error;
  }
};

module.exports = connectDB;
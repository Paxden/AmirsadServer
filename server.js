require("dotenv").config();
const { app, initializeSocket } = require("./src/app");
const connectDB = require("./src/config/db");
const http = require("http");

const PORT = process.env.PORT || 5000;

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Connect to database
connectDB().catch((err) => {
  console.error("Database connection failed:", err);
  process.exit(1);
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
let io;
try {
  io = initializeSocket(server);
  app.set("io", io);
  console.log("✅ Socket.IO initialized");
} catch (error) {
  console.error("Socket.IO initialization failed:", error.message);
}

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📍 API URL: http://localhost:${PORT}/api`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("👋 Shutting down gracefully...");
  server.close(() => {
    console.log("💥 Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥", err);
  server.close(() => process.exit(1));
});

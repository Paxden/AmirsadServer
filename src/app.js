const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");

// Import services
const { initializeSocket } = require("./services/socketService");

// Import routes
const authRoutes = require("./routes/authRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const opportunityRoutes = require("./routes/opportunityRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const buyerRoutes = require("./routes/buyerRoutes");
const rfqRoutes = require("./routes/rfqRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
// Add settings routes
const settingRoutes = require("./routes/settingRoutes");
const reportRoutes = require("./routes/reportRoutes");
// Add task routes
const taskRoutes = require("./routes/taskRoutes");
// Add deal routes
const dealRoutes = require("./routes/dealRoutes");
const adminRoutes = require("./routes/adminRoutes");


const app = express();

/* -------------------------------
   MIDDLEWARE
---------------------------------*/
app.use(helmet());

// Change to allow multiple origins:

// Update the CORS middleware configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://amirsad.vercel.app",
  "https://amirsad-gold-platform.vercel.app",
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
const { finalizeAudit } = require("./middleware/auditMiddleware");

// Serve static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads directory if it doesn't exist
const fs = require("fs");
const uploadDirs = ["uploads/kyc", "uploads/profiles", "uploads/messages"];
uploadDirs.forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

/* -------------------------------
   API ROUTES
---------------------------------*/

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AMIRSAD Gold Trading Platform API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// API Info
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      suppliers: "/api/suppliers",
      opportunities: "/api/opportunities",
      inventory: "/api/inventory",
      buyers: "/api/buyers",
      rfqs: "/api/rfqs",
      appointments: "/api/appointments",
      messages: "/api/messages",
      notifications: "/api/notifications",
    },
  });
});

// Auth Routes
app.use("/api/auth", authRoutes);

// Supplier Routes
app.use("/api/suppliers", supplierRoutes);

// Opportunity Routes
app.use("/api/opportunities", opportunityRoutes);

// Inventory Routes
app.use("/api/inventory", inventoryRoutes);

// Buyer Routes
app.use("/api/buyers", buyerRoutes);

// RFQ Routes
app.use("/api/rfqs", rfqRoutes);

// Appointment Routes
app.use("/api/appointments", appointmentRoutes);

// Message Routes
app.use("/api/messages", messageRoutes);

// Notification Routes
app.use("/api/notifications", notificationRoutes);

// Use dashboard routes
app.use("/api/dashboard", dashboardRoutes);

// Audit finalize middleware (should be last)
const auditRoutes = require("./routes/auditRoutes");
app.use("/api/audit", auditRoutes);
// Add routes
app.use("/api/settings", settingRoutes);
app.use("/api/reports", reportRoutes);
// Task
app.use("/api/tasks", taskRoutes);
// Deal

app.use("/api/deals", dealRoutes);

app.use("/api/admin", adminRoutes);

app.use(finalizeAudit);

// Health check endpoint
app.get("/health", (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    status: "OK",
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV,
  };
  res.status(200).json(health);
});

/* -------------------------------
   404 HANDLER
---------------------------------*/
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* -------------------------------
   GLOBAL ERROR HANDLER
---------------------------------*/
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);

  // Handle specific error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry error",
      field: Object.keys(err.keyPattern)[0],
    });
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "development" ? err.message : "Internal Server Error",
  });
});

module.exports = { app, initializeSocket };

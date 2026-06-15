const express = require("express");
const router = express.Router();

const {
  createProfile,
  getMyProfile,
  submitKYC,
  reviewKYC,
  getAllKYCSubmissions,
  getKYCDetails,
  updateProfileImage,
  getSupplierStats,
  uploadKYCDocuments,
  getKYCStatus,
  
    // Make sure this is exported from controller
} = require("../controllers/supplierController");

const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const uploadDirs = ["uploads/kyc", "uploads/profiles"];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Configure multer for profile image upload
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads/profiles"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `profile-${req.user?.id || req.user?._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images are allowed"));
  },
});

// Configure multer for KYC documents
const kycStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads/kyc"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `kyc-${req.user?.id || req.user?._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images, PDF, and Word documents are allowed"));
  },
}).fields([
  { name: "certificateOfIncorporation", maxCount: 1 },
  { name: "taxClearanceCertificate", maxCount: 1 },
  { name: "directorsIdentification", maxCount: 1 },
  { name: "proofOfAddress", maxCount: 1 },
]);

// ==================== PROTECTED ROUTES ====================
router.use(protect);

// Supplier profile routes
router.post("/profile", authorize("supplier"), createProfile);
router.get("/profile", authorize("supplier"), getMyProfile);
router.put("/profile/image", authorize("supplier"), profileUpload.single("logo"), updateProfileImage);
router.get("/stats", authorize("supplier"), getSupplierStats);

// KYC routes for suppliers
router.post("/submit-kyc", authorize("supplier"), kycUpload, submitKYC);
// Add this route to the supplier routes file
router.get("/kyc/status", protect, authorize("supplier"), getKYCStatus);

// ==================== ADMIN/STAFF ROUTES ====================
router.use(authorize("admin", "staff"));

// KYC review routes
router.put("/review/:id", reviewKYC);
router.get("/kyc-submissions", getAllKYCSubmissions);
router.get("/kyc/:id", getKYCDetails);

router.get("/stats", authorize("supplier"), getSupplierStats);


module.exports = router;
const User = require("../models/User");
const path = require("path");
const fs = require("fs");

/**
 * Create or update supplier profile
 */
exports.createProfile = async (req, res) => {
  try {
    const {
      companyName,
      position,
      address,
      website,
      logo,
      preferredContactMethod,
    } = req.body;

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update profile
    if (!user.profile) user.profile = {};
    user.profile.companyName = companyName || user.profile?.companyName;
    user.profile.position = position || user.profile?.position;
    user.profile.address = address ? (typeof address === 'string' ? JSON.parse(address) : address) : user.profile?.address;
    user.profile.website = website || user.profile?.website;
    user.profile.logo = logo || user.profile?.logo;
    user.profile.preferredContactMethod = preferredContactMethod || user.profile?.preferredContactMethod || "email";

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: user.profile,
    });
  } catch (error) {
    console.error("Create profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create/update profile",
      error: error.message,
    });
  }
};

/**
 * Get supplier profile
 */
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId)
      .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      profile: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isApproved: user.isApproved,
        profile: user.profile || {},
        kyc: user.kyc || {},
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

/**
 * Submit KYC documents
 */
exports.submitKYC = async (req, res) => {
  try {
    const {
      businessName,
      registrationNumber,
      taxId,
      countryOfRegistration,
      businessAddress,
    } = req.body;

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if KYC already submitted and pending/approved
    if (user.kyc?.verificationStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "KYC is already approved. No changes allowed.",
      });
    }

    // Prepare document URLs (from uploaded files)
    const documents = {};
    if (req.files) {
      if (req.files.certificateOfIncorporation) {
        documents.certificateOfIncorporation = req.files.certificateOfIncorporation[0].path;
      }
      if (req.files.taxClearanceCertificate) {
        documents.taxClearanceCertificate = req.files.taxClearanceCertificate[0].path;
      }
      if (req.files.directorsIdentification) {
        documents.directorsIdentification = req.files.directorsIdentification[0].path;
      }
      if (req.files.proofOfAddress) {
        documents.proofOfAddress = req.files.proofOfAddress[0].path;
      }
    }

    // Initialize kyc object if not exists
    if (!user.kyc) user.kyc = {};

    // Update KYC information
    user.kyc.businessName = businessName || user.kyc?.businessName;
    user.kyc.registrationNumber = registrationNumber || user.kyc?.registrationNumber;
    user.kyc.taxId = taxId || user.kyc?.taxId;
    user.kyc.countryOfRegistration = countryOfRegistration || user.kyc?.countryOfRegistration;
    user.kyc.businessAddress = businessAddress ? (typeof businessAddress === 'string' ? JSON.parse(businessAddress) : businessAddress) : user.kyc?.businessAddress;
    user.kyc.documents = { ...user.kyc?.documents, ...documents };
    user.kyc.verificationStatus = "pending";
    user.kyc.submittedAt = new Date();

    await user.save();

    res.status(200).json({
      success: true,
      message: "KYC submitted successfully. Awaiting verification.",
      kyc: {
        businessName: user.kyc.businessName,
        registrationNumber: user.kyc.registrationNumber,
        verificationStatus: user.kyc.verificationStatus,
        submittedAt: user.kyc.submittedAt,
      },
    });
  } catch (error) {
    console.error("Submit KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit KYC",
      error: error.message,
    });
  }
};

/**
 * Review KYC (Admin/Staff only)
 */
exports.reviewKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, notes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'approved' or 'rejected'",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "supplier") {
      return res.status(400).json({
        success: false,
        message: "User is not a supplier",
      });
    }

    if (user.kyc?.verificationStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `KYC is not pending. Current status: ${user.kyc?.verificationStatus}`,
      });
    }

    // Initialize kyc if not exists
    if (!user.kyc) user.kyc = {};

    // Update KYC status
    user.kyc.verificationStatus = status;
    user.kyc.verifiedBy = req.user.id || req.user._id;
    user.kyc.verifiedAt = new Date();
    
    if (status === "rejected") {
      user.kyc.rejectionReason = rejectionReason || "No reason provided";
      user.kyc.notes = notes;
    } else {
      // If approved, also approve the supplier account if not already
      if (!user.isApproved) {
        user.isApproved = true;
        user.approvedBy = req.user.id || req.user._id;
        user.approvedAt = new Date();
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `KYC ${status} successfully`,
      kyc: {
        verificationStatus: user.kyc.verificationStatus,
        verifiedBy: req.user.id,
        verifiedAt: user.kyc.verifiedAt,
        rejectionReason: user.kyc.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Review KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review KYC",
      error: error.message,
    });
  }
};

/**
 * Get all KYC submissions (Admin/Staff)
 */
exports.getAllKYCSubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      role: "supplier",
      "kyc.verificationStatus": { $ne: "not_submitted" },
    };

    if (status) {
      query["kyc.verificationStatus"] = status;
    }

    const submissions = await User.find(query)
      .select("fullName email phone kyc profile.companyName createdAt")
      .sort({ "kyc.submittedAt": -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      submissions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get KYC submissions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch KYC submissions",
    });
  }
};

/**
 * Get KYC details for a specific supplier (Admin/Staff)
 */
exports.getKYCDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("fullName email phone kyc profile")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "supplier") {
      return res.status(400).json({
        success: false,
        message: "User is not a supplier",
      });
    }

    res.status(200).json({
      success: true,
      kyc: user.kyc || {},
      user: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profile: user.profile || {},
      },
    });
  } catch (error) {
    console.error("Get KYC details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch KYC details",
    });
  }
};

/**
 * Update supplier profile image/logo
 */
exports.updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old logo if exists
    if (user.profile?.logo && fs.existsSync(user.profile.logo)) {
      fs.unlinkSync(user.profile.logo);
    }

    if (!user.profile) user.profile = {};
    user.profile.logo = req.file.path;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      logo: user.profile.logo,
    });
  } catch (error) {
    console.error("Update profile image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile image",
    });
  }
};

/**
 * Get supplier statistics (for dashboard)
 */
exports.getSupplierStats = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    const stats = {
      totalOpportunities: 0,
      activeOpportunities: 0,
      soldGold: 0,
      pendingKYC: user?.kyc?.verificationStatus === "pending",
      kycStatus: user?.kyc?.verificationStatus || "not_submitted",
      accountStatus: {
        isVerified: user?.isVerified || false,
        isApproved: user?.isApproved || false,
        isActive: user?.isActive || false,
      },
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get supplier stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};

// Export multer middleware for use in routes
exports.uploadKYCDocuments = (req, res, next) => {
  const multer = require("multer");
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "..", "uploads/kyc"));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `kyc-${req.user?.id || req.user?._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
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

  upload(req, res, next);
};

/**
 * Get KYC status for current supplier
 */
exports.getKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("kyc isApproved fullName email phone profile");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      kyc: {
        verificationStatus: user.kyc?.verificationStatus || "not_submitted",
        submittedAt: user.kyc?.submittedAt,
        verifiedAt: user.kyc?.verifiedAt,
        verifiedBy: user.kyc?.verifiedBy,
        rejectionReason: user.kyc?.rejectionReason,
        notes: user.kyc?.notes,
        businessName: user.kyc?.businessName,
        registrationNumber: user.kyc?.registrationNumber,
        countryOfRegistration: user.kyc?.countryOfRegistration,
      },
      isApproved: user.isApproved,
    });
  } catch (error) {
    console.error("Get KYC status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch KYC status",
      error: error.message,
    });
  }
};

/**
 * Get supplier statistics (for dashboard)
 */
exports.getSupplierStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get opportunity statistics
    const opportunities = await Opportunity.find({ supplier: userId });
    
    const opportunityStats = {
      total: opportunities.length,
      pending: opportunities.filter(o => o.status === "pending").length,
      approved: opportunities.filter(o => o.status === "approved").length,
      rejected: opportunities.filter(o => o.status === "rejected").length,
      totalWeight: opportunities.reduce((sum, o) => sum + (o.weightKg || 0), 0),
      totalValue: opportunities.reduce((sum, o) => sum + ((o.weightKg || 0) * (o.askingPrice || 0)), 0),
    };

    // Get inventory statistics
    const inventory = await Inventory.find({ supplier: userId, isActive: true });
    
    const inventoryStats = {
      total: inventory.length,
      available: inventory.filter(i => i.status === "available").length,
      sold: inventory.filter(i => i.status === "sold").length,
      totalWeight: inventory.reduce((sum, i) => sum + (i.weightKg || 0), 0),
      totalValue: inventory.reduce((sum, i) => sum + ((i.weightKg || 0) * (i.askingPrice || 0)), 0),
    };

    // Get RFQ statistics
    const rfqs = await RFQ.find({ supplier: userId });
    
    const rfqStats = {
      total: rfqs.length,
      pending: rfqs.filter(r => r.status === "pending").length,
      accepted: rfqs.filter(r => r.status === "accepted").length,
      totalValue: rfqs.reduce((sum, r) => sum + (r.offeredTotalPrice || 0), 0),
    };

    // Get appointment statistics
    const appointments = await Appointment.find({ supplier: userId });
    
    const appointmentStats = {
      total: appointments.length,
      upcoming: appointments.filter(a => new Date(a.scheduledDate) > new Date() && a.status === "confirmed").length,
      completed: appointments.filter(a => a.status === "completed").length,
    };

    res.status(200).json({
      success: true,
      data: {
        opportunities: opportunityStats,
        inventory: inventoryStats,
        rfqs: rfqStats,
        appointments: appointmentStats,
      },
    });
  } catch (error) {
    console.error("Get supplier stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};
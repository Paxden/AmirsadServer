const BuyerProfile = require("../models/BuyerProfile");
const User = require("../models/User");

/**
 * Create or update buyer profile
 */
exports.createOrUpdateProfile = async (req, res) => {
  try {
    const {
      companyName,
      registrationNumber,
      taxId,
      country,
      city,
      address,
      buyerType,
      annualPurchaseCapacity,
      preferredGoldTypes,
      preferredPurityRange,
      preferredWeightRange,
      paymentTerms,
      bankDetails,
      preferredCurrencies,
      preferredLocations,
      preferences,
      contactPersons,
    } = req.body;

    let profile = await BuyerProfile.findOne({ user: req.user.id });

    const profileData = {
      user: req.user.id,
      companyName,
      registrationNumber,
      taxId,
      country,
      city,
      address: address ? JSON.parse(address) : undefined,
      buyerType,
      annualPurchaseCapacity,
      preferredGoldTypes,
      preferredPurityRange,
      preferredWeightRange,
      paymentTerms,
      bankDetails,
      preferredCurrencies,
      preferredLocations,
      preferences,
      contactPersons,
      updatedBy: req.user.id,
    };

    if (profile) {
      // Update existing
      profile = await BuyerProfile.findOneAndUpdate(
        { user: req.user.id },
        profileData,
        { new: true, runValidators: true },
      );
    } else {
      // Create new
      profileData.createdBy = req.user.id;
      profile = await BuyerProfile.create(profileData);
    }

    res.status(200).json({
      success: true,
      message: "Profile saved successfully",
      profile,
    });
  } catch (error) {
    console.error("Create/update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save profile",
      error: error.message,
    });
  }
};

/**
 * Get buyer profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;

    // Check authorization
    if (
      req.user.role !== "admin" &&
      req.user.role !== "staff" &&
      req.user.id !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const profile = await BuyerProfile.findOne({ user: userId })
      .populate("user", "fullName email phone isVerified isApproved")
      .populate("verifiedBy", "fullName email")
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Buyer profile not found",
      });
    }

    res.status(200).json({
      success: true,
      profile,
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
    const { documents } = req.body;

    let profile = await BuyerProfile.findOne({ user: req.user.id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Please complete your profile first",
      });
    }

    // Update KYC status
    profile.kycStatus = "pending";
    profile.kycSubmittedAt = new Date();

    // Add documents (in production, files would be uploaded via multer)
    if (documents && documents.length > 0) {
      profile.documents.push(...documents);
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: "KYC submitted successfully. Awaiting verification.",
      kycStatus: profile.kycStatus,
    });
  } catch (error) {
    console.error("Submit KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit KYC",
    });
  }
};

/**
 * Review KYC (Admin/Staff)
 */
exports.reviewKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verificationNotes, rejectionReason } = req.body;

    if (!["approved", "rejected", "under_review"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const profile = await BuyerProfile.findById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    profile.kycStatus = status;
    profile.verifiedBy = req.user.id;
    profile.verificationNotes = verificationNotes;

    if (status === "rejected") {
      profile.rejectionReason = rejectionReason;
    }

    await profile.save();

    // Update user approval status if KYC approved
    if (status === "approved") {
      await User.findByIdAndUpdate(profile.user, {
        isApproved: true,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: `KYC ${status} successfully`,
      kycStatus: profile.kycStatus,
    });
  } catch (error) {
    console.error("Review KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to review KYC",
    });
  }
};

/**
 * Get all buyer profiles (Admin/Staff)
 */
exports.getAllBuyers = async (req, res) => {
  try {
    const {
      kycStatus,
      buyerType,
      country,
      isActive,
      page = 1,
      limit = 20,
      search,
    } = req.query;

    const query = {};

    if (kycStatus) query.kycStatus = kycStatus;
    if (buyerType) query.buyerType = buyerType;
    if (country) query.country = country;
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { registrationNumber: { $regex: search, $options: "i" } },
      ];
    }

    const profiles = await BuyerProfile.find(query)
      .populate("user", "fullName email phone isVerified")
      .sort("-totalPurchased")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BuyerProfile.countDocuments(query);

    res.status(200).json({
      success: true,
      profiles,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get all buyers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyers",
    });
  }
};

/**
 * Get buyer statistics
 */
exports.getBuyerStats = async (req, res) => {
  try {
    const totalBuyers = await BuyerProfile.countDocuments({ isActive: true });
    const verifiedBuyers = await BuyerProfile.countDocuments({
      kycStatus: "approved",
    });
    const pendingKYC = await BuyerProfile.countDocuments({
      kycStatus: "pending",
    });
    const kycStats = await BuyerProfile.getKYCStatistics();

    const topBuyers = await BuyerProfile.getTopBuyers(5);

    res.status(200).json({
      success: true,
      stats: {
        totalBuyers,
        verifiedBuyers,
        pendingKYC,
        kycBreakdown: kycStats,
        topBuyers,
      },
    });
  } catch (error) {
    console.error("Get buyer stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};

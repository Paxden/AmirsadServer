const Opportunity = require("../models/Opportunity");
const User = require("../models/User");
const Inventory = require("../models/Inventory");
const Activity = require("../models/Activity");

/**
 * Create new opportunity
 */
exports.createOpportunity = async (req, res) => {
  try {
    const {
      title,
      description,
      weightKg,
      purity,
      location,
      askingPrice,
      goldType,
      form,
      photos,
      documents,
    } = req.body;

    console.log("Creating opportunity for user:", req.user._id);
    console.log("Request body:", req.body);

    // Get user to verify profile
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    if (!weightKg || weightKg <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid weight in kg is required",
      });
    }

    if (!purity || purity < 0 || purity > 100) {
      return res.status(400).json({
        success: false,
        message: "Valid purity percentage (0-100) is required",
      });
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        message: "Location is required",
      });
    }

    if (!askingPrice || askingPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid asking price is required",
      });
    }

    // Create opportunity with supplier ID
    const opportunity = await Opportunity.create({
      supplier: req.user._id, // This is the key fix - include supplier
      title: title.trim(),
      description: description || "",
      weightKg: parseFloat(weightKg),
      purity: parseFloat(purity),
      location: location.trim(),
      askingPrice: parseFloat(askingPrice),
      goldType: goldType || "refined",
      form: form || "bars",
      currency: "USD",
      photos: photos || [],
      documents: documents || [],
      status: "pending",
      createdBy: req.user._id,
    });

    console.log("Opportunity created:", opportunity._id);

    // Log activity (optional, don't let it break the flow)
    try {
      await Activity.logActivity({
        user: req.user._id,
        action: "OPPORTUNITY_CREATED",
        description: `Created new opportunity: ${title}`,
        metadata: { opportunityId: opportunity._id, weightKg, purity },
      });
    } catch (activityError) {
      console.error("Activity logging failed:", activityError.message);
    }

    res.status(201).json({
      success: true,
      message: "Opportunity created successfully and pending review",
      opportunity,
    });
  } catch (error) {
    console.error("Create opportunity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create opportunity",
      error: error.message,
    });
  }
};

/**
 * Get supplier's opportunities
 */
exports.getMyOpportunities = async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ supplier: req.user._id }).sort("-createdAt");

    res.status(200).json({
      success: true,
      opportunities,
    });
  } catch (error) {
    console.error("Get opportunities error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch opportunities",
    });
  }
};

/**
 * Get opportunity by ID
 */
exports.getOpportunityById = async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await Opportunity.findById(id).populate(
      "supplier",
      "fullName email phone profile"
    );

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    // Check authorization
    const isAuthorized =
      opportunity.supplier._id.toString() === req.user._id ||
      req.user.role === "admin" ||
      req.user.role === "staff";

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      opportunity,
    });
  } catch (error) {
    console.error("Get opportunity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch opportunity",
    });
  }
};

/**
 * Update opportunity
 */
exports.updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    // Check ownership
    if (opportunity.supplier.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Only allow updates if status is pending
    if (opportunity.status !== "pending" && opportunity.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Cannot update opportunity that is already under review",
      });
    }

    const allowedUpdates = [
      "title",
      "description",
      "weightKg",
      "purity",
      "location",
      "askingPrice",
      "goldType",
      "form",
      "currency",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        opportunity[field] = updates[field];
      }
    });

    await opportunity.save();

    res.status(200).json({
      success: true,
      message: "Opportunity updated successfully",
      opportunity,
    });
  } catch (error) {
    console.error("Update opportunity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update opportunity",
    });
  }
};

/**
 * Delete opportunity
 */
exports.deleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    // Check ownership
    if (opportunity.supplier.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Only allow deletion if status is pending or draft
    if (opportunity.status !== "pending" && opportunity.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete opportunity that is already under review",
      });
    }

    await opportunity.deleteOne();

    res.status(200).json({
      success: true,
      message: "Opportunity deleted successfully",
    });
  } catch (error) {
    console.error("Delete opportunity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete opportunity",
    });
  }
};

/**
 * Get all opportunities (admin/staff)
 */
exports.getAllOpportunities = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const opportunities = await Opportunity.find(query)
      .populate("supplier", "fullName email phone profile")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Opportunity.countDocuments(query);

    res.status(200).json({
      success: true,
      opportunities,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get all opportunities error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch opportunities",
    });
  }
};

/**
 * Approve opportunity (admin/staff)
 */
exports.approveOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    if (opportunity.status !== "pending" && opportunity.status !== "under_review") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve opportunity with status: ${opportunity.status}`,
      });
    }

    // Update opportunity
    opportunity.status = "approved";
    opportunity.approvedBy = req.user._id;
    opportunity.approvedAt = new Date();
    opportunity.reviewNote = notes || "";
    await opportunity.save();

    // Check if inventory already exists
    const existingInventory = await Inventory.findOne({ opportunity: opportunity._id });
    if (existingInventory) {
      return res.status(200).json({
        success: true,
        message: "Opportunity approved, inventory already exists",
        opportunity,
        inventory: existingInventory,
      });
    }

    // Calculate values
    const weightKg = opportunity.weightKg || 0;
    const askingPrice = opportunity.askingPrice || 0;
    const pricePerGram = weightKg > 0 ? askingPrice / (weightKg * 1000) : 0;

    // Create inventory from approved opportunity
    const inventoryData = {
      opportunity: opportunity._id,
      supplier: opportunity.supplier,
      weightKg: weightKg,
      availableWeightKg: weightKg,
      purity: opportunity.purity || 0,
      location: opportunity.location || "Not specified",
      askingPrice: askingPrice,
      pricePerGram: pricePerGram,
      goldType: opportunity.goldType || "refined",
      form: opportunity.form || "bars",
      storageLocation: "supplier_premises",
      inspectionAvailable: true,
      status: "available",
      isActive: true,
      currency: "USD",
      createdBy: req.user._id,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    };

    console.log("Creating inventory with data:", inventoryData);

    const inventory = await Inventory.create(inventoryData);

    res.status(200).json({
      success: true,
      message: "Opportunity approved and inventory created",
      opportunity,
      inventory,
    });
  } catch (error) {
    console.error("Approve opportunity error:", error);
    // Log the full error for debugging
    console.error("Error details:", error.message);
    if (error.errors) {
      console.error("Validation errors:", error.errors);
    }
    res.status(500).json({
      success: false,
      message: "Failed to approve opportunity",
      error: error.message,
    });
  }
};

/**
 * Reject opportunity (admin/staff)
 */
exports.rejectOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    opportunity.status = "rejected";
    opportunity.rejectionReason = rejectionReason;
    opportunity.reviewedBy = req.user._id;
    await opportunity.save();

    res.status(200).json({
      success: true,
      message: "Opportunity rejected",
      opportunity,
    });
  } catch (error) {
    console.error("Reject opportunity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject opportunity",
    });
  }
};

/**
 * Get opportunity statistics for admin dashboard
 */
/**
 * Get opportunity statistics for admin dashboard
 */

exports.getOpportunityStats = async (req, res) => {
  try {
    const [
      total,
      pending,
      underReview,
      inspection,
      approved,
      rejected,
      expired,
      weightResult,
      valueResult,
    ] = await Promise.all([
      Opportunity.countDocuments(),

      Opportunity.countDocuments({
        status: "pending",
      }),

      Opportunity.countDocuments({
        status: "under_review",
      }),

      Opportunity.countDocuments({
        status: "inspection",
      }),

      Opportunity.countDocuments({
        status: "approved",
      }),

      Opportunity.countDocuments({
        status: "rejected",
      }),

      Opportunity.countDocuments({
        status: "expired",
      }),

      Opportunity.aggregate([
        {
          $group: {
            _id: null,
            totalWeight: {
              $sum: "$weightKg",
            },
          },
        },
      ]),

      Opportunity.aggregate([
        {
          $group: {
            _id: null,
            totalValue: {
              $sum: "$askingPrice",
            },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        pending,
        underReview,
        inspection,
        approved,
        rejected,
        expired,
        totalWeight: weightResult[0]?.totalWeight || 0,
        totalValue: valueResult[0]?.totalValue || 0,
      },
    });
  } catch (error) {
    console.error("Get Opportunity Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch opportunity statistics",
      error: error.message,
    });
  }
};
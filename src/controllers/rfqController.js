const RFQ = require("../models/RFQ");
const Inventory = require("../models/Inventory");
const BuyerProfile = require("../models/BuyerProfile");
const User = require("../models/User");

/**
 * Create new RFQ
 */
exports.createRFQ = async (req, res) => {
  try {
    const {
      inventoryId,
      requestedWeightKg,
      offeredPricePerKg,
      currency,
      requiredPurity,
      deliveryTerms,
      preferredLocation,
      inspectionRequired,
      validUntil,
      preferredDeliveryDate,
      message,
    } = req.body;

    // Check inventory exists and is available
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    if (inventory.status !== "available") {
      return res.status(400).json({
        success: false,
        message: `Inventory is not available. Status: ${inventory.status}`,
      });
    }

    if (requestedWeightKg > inventory.availableWeightKg) {
      return res.status(400).json({
        success: false,
        message: `Requested weight (${requestedWeightKg}kg) exceeds available (${inventory.availableWeightKg}kg)`,
      });
    }

    // Get buyer profile
    const buyerProfile = await BuyerProfile.findOne({ user: req.user.id });

    // Create RFQ
    const rfq = await RFQ.create({
      buyer: req.user.id,
      buyerProfile: buyerProfile?._id,
      inventory: inventoryId,
      supplier: inventory.supplier,
      requestedWeightKg,
      offeredPricePerKg,
      currency,
      requiredPurity,
      deliveryTerms,
      preferredLocation,
      inspectionRequired,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      preferredDeliveryDate: preferredDeliveryDate
        ? new Date(preferredDeliveryDate)
        : undefined,
      message,
      status: "pending",
      createdBy: req.user.id,
    });

    rfq.addToHistory("created", "RFQ created", offeredPricePerKg, req.user.id);
    await rfq.save();

    res.status(201).json({
      success: true,
      message: "RFQ created successfully",
      rfq,
    });
  } catch (error) {
    console.error("Create RFQ error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create RFQ",
      error: error.message,
    });
  }
};

/**
 * Get RFQs for buyer
 */
exports.getBuyerRFQs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      buyer: req.user.id,
      isActive: true,
    };

    if (status) query.status = status;

    const rfqs = await RFQ.find(query)
      .populate(
        "inventory",
        "weightKg purity askingPrice location goldType photos",
      )
      .populate("supplier", "fullName email phone profile")
      .populate("assignedTo", "fullName email")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RFQ.countDocuments(query);

    res.status(200).json({
      success: true,
      rfqs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get buyer RFQs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch RFQs",
    });
  }
};

/**
 * Get RFQs for supplier
 */
exports.getSupplierRFQs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      supplier: req.user.id,
      isActive: true,
    };

    if (status) query.status = status;

    const rfqs = await RFQ.find(query)
      .populate("buyer", "fullName email phone")
      .populate("buyerProfile", "companyName buyerType kycStatus")
      .populate("inventory", "weightKg purity askingPrice location")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await RFQ.countDocuments(query);

    res.status(200).json({
      success: true,
      rfqs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get supplier RFQs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch RFQs",
    });
  }
};

/**
 * Get RFQ by ID
 */
exports.getRFQById = async (req, res) => {
  try {
    const { id } = req.params;

    const rfq = await RFQ.findById(id)
      .populate("buyer", "fullName email phone")
      .populate("buyerProfile", "companyName buyerType kycStatus")
      .populate("supplier", "fullName email phone profile")
      .populate("inventory")
      .populate("reviewedBy", "fullName email")
      .populate("assignedTo", "fullName email")
      .populate("responseHistory.by", "fullName email")
      .populate("negotiationHistory.userId", "fullName email");

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Check authorization
    const isAuthorized =
      req.user.role === "admin" ||
      req.user.role === "staff" ||
      rfq.buyer._id.toString() === req.user.id ||
      rfq.supplier._id.toString() === req.user.id;

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      rfq,
    });
  } catch (error) {
    console.error("Get RFQ error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch RFQ",
    });
  }
};

/**
 * Staff response to RFQ
 */
exports.staffResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { quotePricePerKg, staffResponse, staffNotes } = req.body;

    const rfq = await RFQ.findById(id);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    rfq.quotePricePerKg = quotePricePerKg;
    rfq.quoteTotalPrice = quotePricePerKg * rfq.requestedWeightKg;
    rfq.staffResponse = staffResponse;
    rfq.staffNotes = staffNotes;
    rfq.status = "quoted";
    rfq.reviewedBy = req.user.id;
    rfq.reviewedAt = new Date();

    rfq.addToHistory("quoted", staffResponse, quotePricePerKg, req.user.id);
    await rfq.save();

    res.status(200).json({
      success: true,
      message: "Response sent to buyer",
      rfq,
    });
  } catch (error) {
    console.error("Staff response error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to respond to RFQ",
    });
  }
};

/**
 * Buyer accepts RFQ
 */
exports.acceptRFQ = async (req, res) => {
  try {
    const { id } = req.params;

    const rfq = await RFQ.findById(id);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    if (rfq.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only the buyer can accept this RFQ",
      });
    }

    await rfq.accept(req.user.id);

    // Update inventory
    const inventory = await Inventory.findById(rfq.inventory);
    await inventory.reserve(rfq.requestedWeightKg, req.user.id);

    res.status(200).json({
      success: true,
      message: "RFQ accepted successfully",
      rfq,
    });
  } catch (error) {
    console.error("Accept RFQ error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept RFQ",
    });
  }
};

/**
 * Get RFQ statistics
 */
exports.getRFQStats = async (req, res) => {
  try {
    const summary = await RFQ.getRFQSummary();

    const pendingCount = await RFQ.countDocuments({
      status: "pending",
      isActive: true,
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    const monthlyRFQs = await RFQ.countDocuments({
      createdAt: { $gte: thisMonth },
      isActive: true,
    });

    res.status(200).json({
      success: true,
      stats: {
        summary,
        pendingCount,
        monthlyRFQs,
        totalRFQs: await RFQ.countDocuments({ isActive: true }),
      },
    });
  } catch (error) {
    console.error("Get RFQ stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};


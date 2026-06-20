const RFQ = require("../models/RFQ");
const Inventory = require("../models/Inventory");
const BuyerProfile = require("../models/BuyerProfile");
const User = require("../models/User");
const NotificationService = require("../services/notificationService");


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

    // Get user ID from request - handle both formats
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      console.error("No user ID found in request:", req.user);
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    console.log("User ID:", userId);
    console.log("User role:", req.user?.role);

    // Validate required fields
    if (!inventoryId) {
      return res.status(400).json({
        success: false,
        message: "Inventory ID is required",
      });
    }

    if (!requestedWeightKg || requestedWeightKg <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid requested weight is required",
      });
    }

    if (!offeredPricePerKg || offeredPricePerKg <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid offered price is required",
      });
    }

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

    // Check if requested weight exceeds available
    const requestedWeight = parseFloat(requestedWeightKg);
    const availableWeight = inventory.availableWeightKg || 0;
    
    if (requestedWeight > availableWeight) {
      return res.status(400).json({
        success: false,
        message: `Requested weight (${requestedWeight}kg) exceeds available (${availableWeight}kg)`,
      });
    }

    // Get buyer profile
    const buyerProfile = await BuyerProfile.findOne({ user: userId });

    // Calculate total price
    const offeredTotalPrice = requestedWeight * parseFloat(offeredPricePerKg);

    // Create RFQ data with correct user ID
    const rfqData = {
      buyer: userId, // Use the extracted userId
      buyerProfile: buyerProfile?._id,
      inventory: inventoryId,
      supplier: inventory.supplier,
      requestedWeightKg: requestedWeight,
      offeredPricePerKg: parseFloat(offeredPricePerKg),
      offeredTotalPrice: offeredTotalPrice,
      currency: currency || "USD",
      requiredPurity: requiredPurity || inventory.purity,
      deliveryTerms: deliveryTerms || "negotiable",
      preferredLocation: preferredLocation || inventory.location,
      inspectionRequired: inspectionRequired !== undefined ? inspectionRequired : true,
      message: message || "",
      status: "pending",
      createdBy: userId,
    };

    // Add optional fields if provided
    if (validUntil) rfqData.validUntil = new Date(validUntil);
    if (preferredDeliveryDate) rfqData.preferredDeliveryDate = new Date(preferredDeliveryDate);

    console.log("Creating RFQ with data:", rfqData);

    const rfq = await RFQ.create(rfqData);

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
/**
 * Get RFQs for buyer
 */
exports.getBuyerRFQs = async (req, res) => {
  try {
    // Get user ID correctly
    const buyerId = req.user.id || req.user._id;
    
    if (!buyerId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    // Build query - match buyer field
    const query = {
      buyer: buyerId,
      isActive: true,
    };

    if (status) query.status = status;

    // Log for debugging
    console.log("Buyer RFQ query:", JSON.stringify(query));
    console.log("Buyer ID:", buyerId);
    console.log("Status filter:", status);

    // Use .lean() to get plain objects
    const rfqs = await RFQ.find(query)
      .populate("buyer", "fullName email phone")
      .populate("buyerProfile", "companyName buyerType kycStatus")
      .populate("inventory", "weightKg purity askingPrice location inventoryNumber")
      .populate("supplier", "fullName email phone")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await RFQ.countDocuments(query);

    console.log(`Found ${total} RFQs for buyer`);

    // Sanitize each RFQ
    const sanitizedRFQs = rfqs.map(rfq => {
      // Ensure currency has a valid value
      return {
        ...rfq,
        currency: rfq.currency || "USD",
        // Remove any problematic fields
        isExpired: undefined,
        totalValueFormatted: undefined,
        quoteValueFormatted: undefined,
        negotiationRound: undefined,
      };
    });

    res.status(200).json({
      success: true,
      rfqs: sanitizedRFQs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get buyer RFQs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyer RFQs",
      error: error.message,
    });
  }
};

/**
 * Get RFQs for supplier
 */
/**
 * Get RFQs for supplier
 */
exports.getSupplierRFQs = async (req, res) => {
  try {
    // Get user ID correctly
    const supplierId = req.user.id || req.user._id;
    
    if (!supplierId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    // Build query - match supplier field
    const query = {
      supplier: supplierId,
      isActive: true,
    };

    if (status) query.status = status;

    // Log for debugging
    console.log("Supplier RFQ query:", JSON.stringify(query));
    console.log("Supplier ID:", supplierId);

    // Use .lean() to get plain objects and avoid virtual serialization issues
    const rfqs = await RFQ.find(query)
      .populate("buyer", "fullName email phone")
      .populate("buyerProfile", "companyName buyerType kycStatus")
      .populate("inventory", "weightKg purity askingPrice location inventoryNumber")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Add .lean() to bypass virtuals

    const total = await RFQ.countDocuments(query);

    console.log(`Found ${total} RFQs for supplier`);

    // Sanitize each RFQ to ensure no virtual fields are present
    const sanitizedRFQs = rfqs.map(rfq => {
      // Remove any virtual fields that might cause issues
      const { isExpired, totalValueFormatted, quoteValueFormatted, negotiationRound, ...cleanRFQ } = rfq;
      
      // Ensure currency has a valid value
      if (!cleanRFQ.currency) {
        cleanRFQ.currency = "USD";
      }
      
      return cleanRFQ;
    });

    res.status(200).json({
      success: true,
      rfqs: sanitizedRFQs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get supplier RFQs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier RFQs",
      error: error.message,
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
/**
 * Buyer accepts RFQ
 */
exports.acceptRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user ID correctly
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const rfq = await RFQ.findById(id);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Check if the user is the buyer
    const rfqBuyerId = rfq.buyer.toString();
    const userIdStr = userId.toString();
    
    console.log("RFQ Buyer ID:", rfqBuyerId);
    console.log("User ID:", userIdStr);
    
    if (rfqBuyerId !== userIdStr) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to accept this RFQ",
        debug: {
          rfqBuyer: rfqBuyerId,
          currentUser: userIdStr
        }
      });
    }

    // Check if RFQ has been quoted
    if (rfq.status !== "quoted" && rfq.status !== "negotiation") {
      return res.status(400).json({
        success: false,
        message: `Cannot accept RFQ with status: ${rfq.status}`,
      });
    }

    // Accept the RFQ
    rfq.status = "accepted";
    rfq.finalPricePerKg = rfq.quotePricePerKg || rfq.offeredPricePerKg;
    rfq.finalTotalPrice = rfq.finalPricePerKg * rfq.requestedWeightKg;
    rfq.reviewedBy = userId;
    rfq.reviewedAt = new Date();
    rfq.addToHistory("accepted", "RFQ accepted by buyer", rfq.finalPricePerKg, userId);
    
    await rfq.save();

    // Create a deal from the accepted RFQ
    let deal = null;
    try {
      const Deal = require("../models/Deal");
      const Inventory = require("../models/Inventory");
      
      // Get inventory details
      const inventory = await Inventory.findById(rfq.inventory);
      if (!inventory) {
        console.error("Inventory not found for RFQ:", rfq.inventory);
      } else {
        // Prepare deal data
        const dealData = {
          rfq: rfq._id,
          inventory: rfq.inventory,
          supplier: rfq.supplier,
          buyer: rfq.buyer,
          quantityKg: rfq.requestedWeightKg,
          agreedPricePerKg: rfq.finalPricePerKg,
          totalAmount: rfq.finalTotalPrice,
          currency: rfq.currency || "USD",
          purity: rfq.requiredPurity || inventory.purity || 0,
          status: "open",
          createdBy: userId,
        };
        
        console.log("Creating deal with data:", dealData);
        
        // Create deal
        deal = await Deal.create(dealData);
        console.log("✅ Deal created from RFQ:", deal.dealNumber);
        
        // Update inventory - reserve the quantity
        inventory.availableWeightKg -= rfq.requestedWeightKg;
        if (inventory.availableWeightKg <= 0) {
          inventory.status = "reserved";
        }
        await inventory.save();
        console.log("✅ Inventory updated, available:", inventory.availableWeightKg);
      }
    } catch (dealError) {
      console.error("❌ Failed to create deal from RFQ:", dealError.message);
      console.error("Full error:", dealError);
      // Don't fail the request if deal creation fails
    }

    // Send notification to supplier
    try {
      const NotificationService = require("../services/notificationService");
      await NotificationService.send(rfq.supplier, {
        title: "RFQ Accepted",
        message: `RFQ ${rfq.rfqNumber} has been accepted by the buyer.${deal ? ` Deal ${deal.dealNumber} has been created.` : ''}`,
        type: "rfq",
        priority: "high",
        relatedType: "rfq",
        relatedId: rfq._id,
        actionUrl: `/dashboard/deals`,
        actionLabel: "View Deals",
      });
    } catch (notifError) {
      console.error("Failed to send notification:", notifError);
    }

    res.status(200).json({
      success: true,
      message: deal ? "RFQ accepted successfully. A deal has been created." : "RFQ accepted successfully.",
      rfq,
      deal: deal || undefined,
    });
  } catch (error) {
    console.error("Accept RFQ error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept RFQ",
      error: error.message,
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

/**
 * Get all RFQs (Admin/Staff only)
 */
exports.getAllRFQs = async (req, res) => {
  try {
    const {
      status,
      buyer,
      supplier,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { isActive: true };

    if (status) query.status = status;
    if (buyer) query.buyer = buyer;
    if (supplier) query.supplier = supplier;
    
    if (search) {
      query.$or = [
        { rfqNumber: { $regex: search, $options: "i" } },
        { "buyer.fullName": { $regex: search, $options: "i" } },
        { "supplier.fullName": { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const rfqs = await RFQ.find(query)
      .populate("buyer", "fullName email phone profile")
      .populate("buyerProfile", "companyName buyerType")
      .populate("supplier", "fullName email phone profile")
      .populate("inventory", "inventoryNumber weightKg purity askingPrice location")
      .populate("assignedTo", "fullName email")
      .populate("reviewedBy", "fullName email")
      .sort(sortOptions)
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
    console.error("Get all RFQs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch RFQs",
      error: error.message,
    });
  }
};

/**
 * Supplier responds to RFQ
 */
exports.supplierRespondToRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { quotePricePerKg, message } = req.body;

    if (!quotePricePerKg) {
      return res.status(400).json({
        success: false,
        message: "Quote price is required",
      });
    }

    const rfq = await RFQ.findById(id);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Check if the user is the supplier for this RFQ
    const supplierId = req.user.id || req.user._id;
    if (rfq.supplier.toString() !== supplierId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to respond to this RFQ",
      });
    }

    // Check if RFQ is still pending
    if (rfq.status !== "pending" && rfq.status !== "under_review") {
      return res.status(400).json({
        success: false,
        message: `Cannot respond to RFQ with status: ${rfq.status}`,
      });
    }

    // Update RFQ with supplier's response
    rfq.quotePricePerKg = parseFloat(quotePricePerKg);
    rfq.quoteTotalPrice = parseFloat(quotePricePerKg) * rfq.requestedWeightKg;
    rfq.staffResponse = message || "Quote provided";
    rfq.status = "quoted";
    rfq.reviewedBy = req.user.id || req.user._id;
    rfq.reviewedAt = new Date();
    
    // Add to history
    rfq.addToHistory("quoted", message || "Supplier provided quote", parseFloat(quotePricePerKg), req.user.id || req.user._id);

    await rfq.save();

    // Send notification to buyer
    await NotificationService.send(rfq.buyer, {
      title: "Quote Received",
      message: `You have received a quote for RFQ ${rfq.rfqNumber}`,
      type: "rfq",
      priority: "high",
      relatedType: "rfq",
      relatedId: rfq._id,
      actionUrl: `/dashboard/rfqs/${rfq._id}`,
      actionLabel: "View Quote",
    });

    res.status(200).json({
      success: true,
      message: "Quote sent to buyer successfully",
      rfq,
    });
  } catch (error) {
    console.error("Supplier respond to RFQ error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to respond to RFQ",
      error: error.message,
    });
  }
};

/**
 * Cancel RFQ (Buyer only)
 */
exports.cancelRFQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Get user ID correctly
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const rfq = await RFQ.findById(id);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Check if the user is the buyer for this RFQ
    const rfqBuyerId = rfq.buyer.toString();
    const userIdStr = userId.toString();
    
    if (rfqBuyerId !== userIdStr) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this RFQ",
      });
    }

    // Check if RFQ can be cancelled (only pending or quoted)
    if (rfq.status !== "pending" && rfq.status !== "quoted") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel RFQ with status: ${rfq.status}`,
      });
    }

    // Cancel the RFQ
    rfq.status = "cancelled";
    rfq.staffResponse = reason || "Cancelled by buyer";
    rfq.addToHistory("cancelled", reason || "Cancelled by buyer", null, userId);
    
    await rfq.save();

    // Send notification to supplier
    try {
      const NotificationService = require("../services/notificationService");
      await NotificationService.send(rfq.supplier, {
        title: "RFQ Cancelled",
        message: `RFQ ${rfq.rfqNumber} has been cancelled by the buyer. Reason: ${reason || "No reason provided"}`,
        type: "rfq",
        priority: "normal",
        relatedType: "rfq",
        relatedId: rfq._id,
        actionUrl: `/dashboard/rfqs/${rfq._id}`,
        actionLabel: "View RFQ",
      });
    } catch (notifError) {
      console.error("Failed to send notification:", notifError);
    }

    res.status(200).json({
      success: true,
      message: "RFQ cancelled successfully",
      rfq,
    });
  } catch (error) {
    console.error("Cancel RFQ error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel RFQ",
      error: error.message,
    });
  }
};
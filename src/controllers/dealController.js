const Deal = require("../models/Deal");
const Inventory = require("../models/Inventory");
const RFQ = require("../models/RFQ");
const Activity = require("../models/Activity");
const NotificationService = require("../services/notificationService");
const AuditLog = require("../models/AuditLog");

// Safe activity logger that won't break the main flow
const safeLogActivity = async (data) => {
  try {
    await Activity.logActivity(data);
  } catch (error) {
    console.error("Activity logging failed:", error.message);
    // Don't throw - just log the error
  }
};

/**
 * Create new deal from accepted RFQ
 */
exports.createDeal = async (req, res) => {
  try {
    const { rfqId, inventoryId, quantityKg, agreedPricePerKg, paymentTerms, deliveryTerms } =
      req.body;

    // Validate required fields
    if (!rfqId || !inventoryId) {
      return res.status(400).json({
        success: false,
        message: "RFQ ID and Inventory ID are required",
      });
    }

    // Get RFQ details
    const rfq = await RFQ.findById(rfqId);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Get inventory details
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    // Check if inventory is available
    if (inventory.status !== "available") {
      return res.status(400).json({
        success: false,
        message: `Inventory is not available. Current status: ${inventory.status}`,
      });
    }

    // Check if deal already exists
    const existingDeal = await Deal.findOne({ rfq: rfqId });
    if (existingDeal) {
      return res.status(400).json({
        success: false,
        message: "Deal already exists for this RFQ",
      });
    }

    const dealQuantity = quantityKg || rfq.requestedWeightKg;
    const dealPrice = agreedPricePerKg || rfq.quotePricePerKg || rfq.offeredPricePerKg;

    // Check if requested quantity is available
    if (dealQuantity > inventory.availableWeightKg) {
      return res.status(400).json({
        success: false,
        message: `Requested quantity (${dealQuantity}kg) exceeds available inventory (${inventory.availableWeightKg}kg)`,
      });
    }

    // Create deal
    const deal = await Deal.create({
      rfq: rfqId,
      inventory: inventoryId,
      supplier: rfq.supplier,
      buyer: rfq.buyer,
      quantityKg: dealQuantity,
      agreedPricePerKg: dealPrice,
      totalAmount: dealQuantity * dealPrice,
      currency: rfq.currency || "USD",
      purity: inventory.purity,
      paymentTerms: paymentTerms || "negotiable",
      deliveryTerms: deliveryTerms || "ex_works",
      createdBy: req.user.id,
      status: "open",
      timeline: {
        openedAt: new Date(),
      },
    });

    // Update inventory - reserve the quantity
    inventory.availableWeightKg -= dealQuantity;
    if (inventory.availableWeightKg === 0) {
      inventory.status = "reserved";
    }
    inventory.updatedBy = req.user.id;
    await inventory.save();

    // Update RFQ status
    rfq.status = "accepted";
    await rfq.save();

    // Log activity
    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "DEAL_CREATED",
      description: `Deal ${deal.dealNumber} created from RFQ ${rfq.rfqNumber}`,
      metadata: { rfqId, inventoryId, quantity: deal.quantityKg, price: deal.agreedPricePerKg },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Audit log
    await AuditLog.log({
      user: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "DEAL_CREATE",
      module: "deals",
      entityId: deal._id,
      entityType: "Deal",
      details: { dealNumber: deal.dealNumber, rfqNumber: rfq.rfqNumber },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notifications
    await NotificationService.send(deal.supplier, {
      title: "New Deal Created",
      message: `A new deal (${deal.dealNumber}) has been created for your gold inventory.`,
      type: "rfq",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
      actionLabel: "View Deal",
    });

    await NotificationService.send(deal.buyer, {
      title: "Deal Confirmed",
      message: `Your deal ${deal.dealNumber} has been confirmed. Proceed with next steps.`,
      type: "rfq",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
      actionLabel: "View Deal",
    });

    res.status(201).json({
      success: true,
      message: "Deal created successfully",
      deal,
    });
  } catch (error) {
    console.error("Create deal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create deal",
      error: error.message,
    });
  }
};

/**
 * Get all deals (Admin/Staff)
 */
exports.getAllDeals = async (req, res) => {
  try {
    const {
      status,
      supplierId,
      buyerId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query - remove isActive filter if it's causing issues
    const query = {};

    // Only filter by isActive if the field exists, otherwise return all
    // Option 1: Remove isActive filter entirely
    // Option 2: Check if deals have isActive field

    if (status) query.status = status;
    if (supplierId) query.supplier = supplierId;
    if (buyerId) query.buyer = buyerId;

    if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
      query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    console.log("Deals query:", JSON.stringify(query));

    const deals = await Deal.find(query)
      .populate("supplier", "fullName email phone profile")
      .populate("buyer", "fullName email phone profile")
      .populate("inventory", "inventoryNumber weightKg purity")
      .populate("rfq", "rfqNumber offeredPricePerKg")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Deal.countDocuments(query);

    console.log(`Found ${total} deals`);

    res.status(200).json({
      success: true,
      deals,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get all deals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deals",
      error: error.message,
    });
  }
};

/**
 * Get user's deals (supplier or buyer)
 */
exports.getMyDeals = async (req, res) => {
  try {
    // Get user ID correctly - check both id and _id
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

   

    const { status, page = 1, limit = 20 } = req.query;

    // Build query based on user role
    let query = { isActive: true };
    const userRole = req.user.role;

    if (userRole === "supplier") {
      query.supplier = userId;
    } else if (userRole === "buyer") {
      query.buyer = userId;
    } else {
      // Admin/Staff - show all deals they're involved in
      query.$or = [{ supplier: userId }, { buyer: userId }];
    }

    if (status) query.status = status;

    // Log for debugging
    console.log("🔍 GetMyDeals query:", JSON.stringify(query));
    console.log("👤 User ID:", userId.toString());
    console.log("📋 User Role:", userRole);

    const deals = await Deal.find(query)
      .populate("supplier", "fullName email phone profile")
      .populate("buyer", "fullName email phone profile")
      .populate("inventory", "inventoryNumber weightKg purity askingPrice")
      .populate("rfq", "rfqNumber offeredPricePerKg")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Deal.countDocuments(query);

    console.log(`✅ Found ${total} deals for ${userRole} ${userId.toString()}`);

    res.status(200).json({
      success: true,
      deals,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("❌ Get my deals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deals",
      error: error.message,
    });
  }
};

/**
 * Get deal by ID
 */
exports.getDealById = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id)
      .populate("supplier", "fullName email phone profile companyName")
      .populate("buyer", "fullName email phone profile companyName")
      .populate("inventory")
      .populate("rfq")
      .populate("statusHistory.changedBy", "fullName email")
      .populate("offerHistory.proposedBy", "fullName email")
      .populate("inspection.inspector", "fullName email")
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email");

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    // Check authorization
    const isAuthorized =
      req.user.role === "admin" ||
      req.user.role === "staff" ||
      (deal.supplier && deal.supplier._id.toString() === req.user.id) ||
      (deal.buyer && deal.buyer._id.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own deals.",
      });
    }

    res.status(200).json({
      success: true,
      deal,
    });
  } catch (error) {
    console.error("Get deal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deal",
    });
  }
};

/**
 * Update deal status
 */
exports.updateDealStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      "open",
      "inspection_scheduled",
      "inspection_completed",
      "inspection_passed",
      "inspection_failed",
      "offer_made",
      "offer_accepted",
      "agreement_signed",
      "payment_pending",
      "payment_received",
      "delivery_scheduled",
      "delivery_completed",
      "closed",
      "cancelled",
      "disputed",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    const oldStatus = deal.status;

    // Update status history
    deal.statusHistory.push({
      status,
      changedBy: req.user.id,
      changedAt: new Date(),
      notes,
    });

    deal.status = status;
    deal.updatedBy = req.user.id;

    // Update timeline based on status
    if (status === "inspection_scheduled" && !deal.timeline.inspectionAt) {
      deal.timeline.inspectionAt = new Date();
    }
    if (status === "offer_accepted" && !deal.timeline.offerAt) {
      deal.timeline.offerAt = new Date();
    }
    if (status === "agreement_signed" && !deal.timeline.agreementAt) {
      deal.timeline.agreementAt = new Date();
    }
    if (status === "payment_received" && !deal.timeline.paymentAt) {
      deal.timeline.paymentAt = new Date();
    }
    if (status === "delivery_completed" && !deal.timeline.deliveryAt) {
      deal.timeline.deliveryAt = new Date();
    }
    if (status === "closed" && !deal.timeline.closedAt) {
      deal.timeline.closedAt = new Date();
    }

    await deal.save();

    // Log activity
    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "DEAL_STATUS_CHANGE",
      description: `Deal status changed from ${oldStatus} to ${status}`,
      metadata: { oldStatus, newStatus: status, notes },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notifications
    const notificationTitle = `Deal Status Update: ${deal.dealNumber}`;
    const notificationMessage = `Deal status has been updated to ${status.replace(/_/g, " ")}`;

    await NotificationService.send(deal.supplier, {
      title: notificationTitle,
      message: notificationMessage,
      type: "system",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    await NotificationService.send(deal.buyer, {
      title: notificationTitle,
      message: notificationMessage,
      type: "system",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    res.status(200).json({
      success: true,
      message: "Deal status updated",
      deal,
    });
  } catch (error) {
    console.error("Update deal status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update deal status",
    });
  }
};

/**
 * Schedule inspection
 */
exports.scheduleInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, inspector, location, notes } = req.body;

    if (!scheduledDate || !inspector) {
      return res.status(400).json({
        success: false,
        message: "Scheduled date and inspector are required",
      });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    deal.inspection = {
      scheduledDate: new Date(scheduledDate),
      inspector,
      notes,
      location: location || deal.inspection?.location,
    };
    deal.status = "inspection_scheduled";
    deal.updatedBy = req.user.id;
    await deal.save();

    // Update status history
    deal.statusHistory.push({
      status: "inspection_scheduled",
      changedBy: req.user.id,
      changedAt: new Date(),
      notes: `Inspection scheduled for ${new Date(scheduledDate).toLocaleString()}`,
    });
    await deal.save();

    // Log activity
    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "INSPECTION_SCHEDULED",
      description: `Inspection scheduled for ${new Date(scheduledDate).toLocaleString()}`,
      metadata: { scheduledDate, inspector, location },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notifications
    await NotificationService.send(deal.supplier, {
      title: "Inspection Scheduled",
      message: `An inspection has been scheduled for your gold on ${new Date(scheduledDate).toLocaleString()}`,
      type: "appointment",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    await NotificationService.send(deal.buyer, {
      title: "Inspection Scheduled",
      message: `Inspection scheduled for ${new Date(scheduledDate).toLocaleString()}`,
      type: "appointment",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    res.status(200).json({
      success: true,
      message: "Inspection scheduled successfully",
      deal,
    });
  } catch (error) {
    console.error("Schedule inspection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule inspection",
    });
  }
};

/**
 * Complete inspection
 */
exports.completeInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const { passed, report, notes } = req.body;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    deal.inspection = {
      ...deal.inspection,
      completedDate: new Date(),
      report,
      passed,
      notes,
    };
    deal.status = passed ? "inspection_passed" : "inspection_failed";
    deal.updatedBy = req.user.id;
    await deal.save();

    // Update status history
    deal.statusHistory.push({
      status: passed ? "inspection_passed" : "inspection_failed",
      changedBy: req.user.id,
      changedAt: new Date(),
      notes: `Inspection ${passed ? "passed" : "failed"}: ${notes || ""}`,
    });
    await deal.save();

    // Log activity
    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "INSPECTION_COMPLETED",
      description: `Inspection ${passed ? "passed" : "failed"}`,
      metadata: { passed, notes },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Send notifications
    await NotificationService.send(deal.supplier, {
      title: "Inspection Completed",
      message: `Inspection ${passed ? "passed" : "failed"} for deal ${deal.dealNumber}`,
      type: "appointment",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    await NotificationService.send(deal.buyer, {
      title: "Inspection Completed",
      message: `Inspection ${passed ? "passed" : "failed"} for deal ${deal.dealNumber}`,
      type: "appointment",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    res.status(200).json({
      success: true,
      message: `Inspection ${passed ? "passed" : "completed"}`,
      deal,
    });
  } catch (error) {
    console.error("Complete inspection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete inspection",
    });
  }
};

/**
 * Make offer on deal
 */
exports.makeOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { pricePerKg, notes } = req.body;

    if (!pricePerKg) {
      return res.status(400).json({
        success: false,
        message: "Price per kg is required",
      });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    const totalAmount = pricePerKg * deal.quantityKg;

    deal.offerHistory.push({
      amount: totalAmount,
      pricePerKg,
      proposedBy: req.user.id,
      proposedAt: new Date(),
      status: "pending",
      notes,
    });

    deal.status = "offer_made";
    deal.updatedBy = req.user.id;
    await deal.save();

    // Determine who to notify
    const notifyUser = req.user.id === deal.supplier.toString() ? deal.buyer : deal.supplier;

    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "OFFER_MADE",
      description: `New offer of ${pricePerKg}/kg made on deal ${deal.dealNumber}`,
      metadata: { pricePerKg, totalAmount, notes },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    await NotificationService.send(notifyUser, {
      title: "New Offer Received",
      message: `A new offer of ${pricePerKg}/${deal.currency}/kg has been made on deal ${deal.dealNumber}`,
      type: "rfq",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
      actionLabel: "Review Offer",
    });

    res.status(200).json({
      success: true,
      message: "Offer submitted successfully",
      deal,
    });
  } catch (error) {
    console.error("Make offer error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit offer",
    });
  }
};

/**
 * Accept offer
 */
exports.acceptOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    const lastOffer = deal.offerHistory[deal.offerHistory.length - 1];
    if (!lastOffer) {
      return res.status(400).json({
        success: false,
        message: "No offer found to accept",
      });
    }

    deal.finalOffer = {
      amount: lastOffer.amount,
      pricePerKg: lastOffer.pricePerKg,
      acceptedAt: new Date(),
      acceptedBy: req.user.id,
    };
    deal.agreedPricePerKg = lastOffer.pricePerKg;
    deal.totalAmount = lastOffer.amount;
    deal.status = "offer_accepted";
    deal.updatedBy = req.user.id;
    await deal.save();

    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "OFFER_ACCEPTED",
      description: `Offer accepted at ${deal.finalOffer.pricePerKg}/${deal.currency}/kg`,
      metadata: { finalPrice: deal.finalOffer.pricePerKg, totalAmount: deal.totalAmount },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    await NotificationService.send(deal.supplier, {
      title: "Offer Accepted",
      message: `Your offer of ${deal.finalOffer.pricePerKg}/${deal.currency}/kg has been accepted for deal ${deal.dealNumber}`,
      type: "rfq",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    await NotificationService.send(deal.buyer, {
      title: "Offer Accepted",
      message: `The offer of ${deal.finalOffer.pricePerKg}/${deal.currency}/kg has been accepted for deal ${deal.dealNumber}`,
      type: "rfq",
      priority: "high",
      relatedType: "deal",
      relatedId: deal._id,
      actionUrl: `/dashboard/deals/${deal._id}`,
    });

    res.status(200).json({
      success: true,
      message: "Offer accepted successfully",
      deal,
    });
  } catch (error) {
    console.error("Accept offer error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept offer",
    });
  }
};

/**
 * Record payment
 */
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reference, method, notes } = req.body;

    if (!amount || !reference) {
      return res.status(400).json({
        success: false,
        message: "Amount and reference are required",
      });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    if (!deal.payment) {
      deal.payment = { transactions: [] };
    }

    if (!deal.payment.transactions) {
      deal.payment.transactions = [];
    }

    deal.payment.transactions.push({
      amount,
      date: new Date(),
      reference,
      method,
      notes,
    });

    // Update payment status
    const totalPaid = deal.payment.transactions.reduce((sum, t) => sum + t.amount, 0);

    if (totalPaid >= deal.totalAmount) {
      deal.payment.status = "paid";
      deal.payment.paidAt = new Date();
      deal.status = "payment_received";
    } else if (totalPaid > 0) {
      deal.payment.status = "partial";
    } else {
      deal.payment.status = "pending";
    }

    deal.payment.amount = totalPaid;
    await deal.save();

    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "PAYMENT_RECORDED",
      description: `Payment of ${amount} ${deal.currency} recorded`,
      metadata: { amount, reference, totalPaid },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      deal,
    });
  } catch (error) {
    console.error("Record payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record payment",
    });
  }
};

/**
 * Schedule delivery
 */
exports.scheduleDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, method, address, trackingNumber, notes } = req.body;

    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        message: "Scheduled date is required",
      });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    deal.delivery = {
      scheduledDate: new Date(scheduledDate),
      method: method || "pickup",
      address: address || {},
      trackingNumber,
      notes,
    };
    deal.status = "delivery_scheduled";
    deal.updatedBy = req.user.id;
    await deal.save();

    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "DELIVERY_SCHEDULED",
      description: `Delivery scheduled for ${new Date(scheduledDate).toLocaleString()}`,
      metadata: { scheduledDate, method, trackingNumber },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Delivery scheduled successfully",
      deal,
    });
  } catch (error) {
    console.error("Schedule delivery error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule delivery",
    });
  }
};

/**
 * Complete delivery
 */
exports.completeDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    if (!deal.delivery) {
      deal.delivery = {};
    }

    deal.delivery.completedDate = new Date();
    deal.status = "delivery_completed";
    deal.updatedBy = req.user.id;
    await deal.save();

    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "DELIVERY_COMPLETED",
      description: "Delivery completed",
      metadata: { notes },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Delivery completed successfully",
      deal,
    });
  } catch (error) {
    console.error("Complete delivery error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete delivery",
    });
  }
};

/**
 * Close deal
 */
exports.closeDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierRating, buyerRating, supplierFeedback, buyerFeedback } = req.body;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    deal.status = "closed";
    deal.timeline.closedAt = new Date();

    if (supplierRating) {
      deal.supplierRating = {
        rating: supplierRating,
        feedback: supplierFeedback,
        ratedAt: new Date(),
      };
    }
    if (buyerRating) {
      deal.buyerRating = {
        rating: buyerRating,
        feedback: buyerFeedback,
        ratedAt: new Date(),
      };
    }

    await deal.save();

    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "DEAL_CLOSED",
      description: "Deal successfully closed",
      metadata: { supplierRating, buyerRating },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Deal closed successfully",
      deal,
    });
  } catch (error) {
    console.error("Close deal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to close deal",
    });
  }
};

/**
 * Cancel deal
 */
exports.cancelDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    deal.status = "cancelled";
    deal.cancellationReason = reason;
    deal.timeline.closedAt = new Date();
    deal.updatedBy = req.user.id;
    await deal.save();

    // Release inventory back to available
    const inventory = await Inventory.findById(deal.inventory);
    if (inventory) {
      inventory.availableWeightKg += deal.quantityKg;
      if (inventory.status === "reserved") {
        inventory.status = "available";
      }
      await inventory.save();
    }

    await safeLogActivity({
      user: req.user.id,
      deal: deal._id,
      action: "DEAL_CANCELLED",
      description: `Deal cancelled: ${reason}`,
      metadata: { reason },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(200).json({
      success: true,
      message: "Deal cancelled successfully",
      deal,
    });
  } catch (error) {
    console.error("Cancel deal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel deal",
    });
  }
};

/**
 * Get deal statistics
 */
exports.getDealStats = async (req, res) => {
  try {
    const summary = await Deal.getDealSummary();

    const monthlyStats = await Deal.aggregate([
      {
        $match: {
          isActive: true,
          createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
          totalValue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const topSuppliers = await Deal.aggregate([
      { $match: { status: "closed", isActive: true } },
      {
        $group: {
          _id: "$supplier",
          totalValue: { $sum: "$totalAmount" },
          totalDeals: { $sum: 1 },
        },
      },
      { $sort: { totalValue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "supplier",
        },
      },
    ]);

    const topBuyers = await Deal.aggregate([
      { $match: { status: "closed", isActive: true } },
      {
        $group: {
          _id: "$buyer",
          totalValue: { $sum: "$totalAmount" },
          totalDeals: { $sum: 1 },
        },
      },
      { $sort: { totalValue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "buyer",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      summary,
      monthlyStats,
      topSuppliers,
      topBuyers,
    });
  } catch (error) {
    console.error("Get deal stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deal statistics",
    });
  }
};


/**
 * Rate deal (supplier or buyer)
 */
exports.rateDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierRating, buyerRating, supplierFeedback, buyerFeedback } = req.body;

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    // Check if user is part of the deal
    if (deal.supplier.toString() !== req.user.id && deal.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to rate this deal",
      });
    }

    // Determine if user is supplier or buyer
    const isSupplier = deal.supplier.toString() === req.user.id;

    if (isSupplier && buyerRating) {
      deal.buyerRating = {
        rating: buyerRating,
        feedback: buyerFeedback,
        ratedAt: new Date(),
      };
    } else if (!isSupplier && supplierRating) {
      deal.supplierRating = {
        rating: supplierRating,
        feedback: supplierFeedback,
        ratedAt: new Date(),
      };
    }

    await deal.save();

    res.status(200).json({
      success: true,
      message: "Rating submitted successfully",
    });
  } catch (error) {
    console.error("Rate deal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit rating",
    });
  }
};

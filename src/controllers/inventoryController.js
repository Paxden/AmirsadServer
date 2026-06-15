const Inventory = require("../models/Inventory");
const User = require("../models/User");
const mongoose = require("mongoose");

/**
 * Create new inventory item (from approved opportunity)
 */
exports.createInventory = async (req, res) => {
  try {
    const {
      opportunity,
      supplier,
      weightKg,
      purity,
      location,
      askingPrice,
      goldType,
      form,
      storageLocation,
      inspectionAvailable,
      inspectionAddress,
      minimumOrderKg,
      qualityCertificate,
      assayReport,
      availableUntil,
      notes,
    } = req.body;

    // Verify supplier exists
    const supplierExists = await User.findById(supplier);
    if (!supplierExists || supplierExists.role !== "supplier") {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // Check if inventory already exists for this opportunity
    const existingInventory = await Inventory.findOne({ opportunity });
    if (existingInventory) {
      return res.status(400).json({
        success: false,
        message: "Inventory already exists for this opportunity",
      });
    }

    const inventory = await Inventory.create({
      opportunity,
      supplier,
      weightKg,
      availableWeightKg: weightKg,
      purity,
      location,
      askingPrice,
      goldType,
      form,
      storageLocation,
      inspectionAvailable,
      inspectionAddress: inspectionAddress
        ? JSON.parse(inspectionAddress)
        : undefined,
      minimumOrderKg,
      qualityCertificate,
      assayReport,
      availableUntil: availableUntil ? new Date(availableUntil) : undefined,
      notes,
      createdBy: req.user.id,
      status: "pending_approval",
    });

    res.status(201).json({
      success: true,
      message: "Inventory created and pending approval",
      inventory,
    });
  } catch (error) {
    console.error("Create inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create inventory",
      error: error.message,
    });
  }
};

/**
 * Get all inventory with filters
 */
exports.getAllInventory = async (req, res) => {
  try {
    const {
      status,
      supplier,
      minWeight,
      maxWeight,
      minPurity,
      maxPurity,
      location,
      goldType,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { isActive: true };

    if (status) query.status = status;
    if (supplier) query.supplier = supplier;
    if (location) query.location = { $regex: location, $options: "i" };
    if (goldType) query.goldType = goldType;
    if (minWeight) query.weightKg = { $gte: parseFloat(minWeight) };
    if (maxWeight)
      query.weightKg = { ...query.weightKg, $lte: parseFloat(maxWeight) };
    if (minPurity) query.purity = { $gte: parseFloat(minPurity) };
    if (maxPurity)
      query.purity = { ...query.purity, $lte: parseFloat(maxPurity) };
    if (minPrice) query.askingPrice = { $gte: parseFloat(minPrice) };
    if (maxPrice)
      query.askingPrice = { ...query.askingPrice, $lte: parseFloat(maxPrice) };

    // Only show available inventory to buyers
    if (req.user.role === "buyer") {
      query.status = "available";
      query.isExpired = false;
      query.availableUntil = { $gt: new Date() };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const inventory = await Inventory.find(query)
      .populate("supplier", "fullName email phone profile companyName")
      .populate("approvedBy", "fullName email")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Inventory.countDocuments(query);

    res.status(200).json({
      success: true,
      inventory,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
    });
  }
};

/**
 * Get inventory by ID
 */
exports.getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const inventory = await Inventory.findById(id)
      .populate("supplier", "fullName email phone profile companyName")
      .populate("approvedBy", "fullName email")
      .populate("buyer", "fullName email");

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    // Check access rights
    if (req.user.role === "buyer" && inventory.status !== "available") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This inventory is not available.",
      });
    }

    res.status(200).json({
      success: true,
      inventory,
    });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
    });
  }
};

/**
 * Get supplier inventory
 */
exports.getSupplierInventory = async (req, res) => {
  try {
    // If route is /supplier/me or no supplierId param
    const supplierId = req.params.supplierId || req.user.id;

    // Check authorization
    if (
      req.user.role !== "admin" &&
      req.user.role !== "staff" &&
      req.user.id !== supplierId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Fetch supplier inventory
    const query = { supplier: supplierId, isActive: true };

    // If requester is buyer, only show available
    if (req.user.role === "buyer") {
      query.status = "available";
      query.isExpired = false;
      query.availableUntil = { $gt: new Date() };
    }

    const inventory = await Inventory.find(query)
      .populate("supplier", "fullName email phone profile companyName")
      .populate("approvedBy", "fullName email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, inventory });
  } catch (error) {
    console.error("Get supplier inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier inventory",
    });
  }
}; // ✅ Removed extra brace and comma


/**
 * Approve inventory (Admin/Staff)
 */
exports.approveInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const inventory = await Inventory.findById(id);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    if (inventory.status !== "pending_approval") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve inventory with status: ${inventory.status}`,
      });
    }

    inventory.status = "available";
    inventory.approvedBy = req.user.id;
    inventory.approvedAt = new Date();
    inventory.notes = notes || inventory.notes;

    await inventory.save();

    // TODO: Send notification to supplier

    res.status(200).json({
      success: true,
      message: "Inventory approved and now available for buyers",
      inventory,
    });
  } catch (error) {
    console.error("Approve inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve inventory",
    });
  }
};

/**
 * Reject inventory (Admin/Staff)
 */
exports.rejectInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const inventory = await Inventory.findById(id);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    inventory.status = "rejected";
    inventory.rejectionReason = rejectionReason;
    inventory.updatedBy = req.user.id;

    await inventory.save();

    res.status(200).json({
      success: true,
      message: "Inventory rejected",
      inventory,
    });
  } catch (error) {
    console.error("Reject inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject inventory",
    });
  }
};

/**
 * Update inventory
 */
exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const inventory = await Inventory.findById(id);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    // Check ownership or admin
    if (
      inventory.supplier.toString() !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "staff"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Don't allow editing if status is not pending or available
    if (
      inventory.status !== "pending_approval" &&
      inventory.status !== "available"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot update inventory with status: ${inventory.status}`,
      });
    }

    const allowedUpdates = [
      "weightKg",
      "purity",
      "location",
      "askingPrice",
      "goldType",
      "form",
      "storageLocation",
      "inspectionAvailable",
      "minimumOrderKg",
      "notes",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        inventory[field] = updates[field];
      }
    });

    if (updates.weightKg && updates.weightKg !== inventory.weightKg) {
      const ratio = inventory.availableWeightKg / inventory.weightKg;
      inventory.availableWeightKg = updates.weightKg * ratio;
    }

    inventory.updatedBy = req.user.id;
    await inventory.save();

    res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      inventory,
    });
  } catch (error) {
    console.error("Update inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory",
    });
  }
};

/**
 * Delete inventory (soft delete)
 */
exports.deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const inventory = await Inventory.findById(id);

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    // Check ownership or admin
    if (
      inventory.supplier.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    inventory.isActive = false;
    inventory.deletedAt = new Date();
    inventory.status = "archived";
    await inventory.save();

    res.status(200).json({
      success: true,
      message: "Inventory deleted successfully",
    });
  } catch (error) {
    console.error("Delete inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inventory",
    });
  }
};

/**
 * Get inventory statistics
 */
exports.getInventoryStats = async (req, res) => {
  try {
    const stats = await Inventory.getSummary();

    const totalAvailable = await Inventory.aggregate([
      {
        $match: {
          status: "available",
          isActive: true,
          isExpired: false,
          availableUntil: { $gt: new Date() },
        },
      },
      {
        $group: {
          _id: null,
          totalWeight: { $sum: "$availableWeightKg" },
          totalValue: {
            $sum: { $multiply: ["$availableWeightKg", "$askingPrice"] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      stats,
      available: totalAvailable[0] || {
        totalWeight: 0,
        totalValue: 0,
        count: 0,
      },
    });
  } catch (error) {
    console.error("Get inventory stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
};

const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    inventoryNumber: {
      type: String,
      unique: true,
      index: true,
    },

    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Gold Specifications
    weightKg: {
      type: Number,
      required: true,
      min: 0.01,
    },

    availableWeightKg: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function(value) {
          return value <= this.weightKg;
        },
        message: "Available weight cannot exceed total weight",
      },
    },

    purity: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      validate: {
        validator: function(value) {
          return value >= 0 && value <= 100;
        },
        message: "Purity must be between 0 and 100",
      },
    },

    // Gold Type and Form
    goldType: {
      type: String,
      enum: ["doré", "refined", "scrap", "bars", "nuggets"],
      default: "refined",
    },

    form: {
      type: String,
      enum: ["bars", "coins", "granules", "powder", "other"],
      default: "bars",
    },

    // Location and Logistics
    location: {
      type: String,
      required: true,
      index: true,
    },

    storageLocation: {
      type: String,
      enum: ["vault", "warehouse", "supplier_premises", "third_party"],
      default: "supplier_premises",
    },

    inspectionAvailable: {
      type: Boolean,
      default: true,
    },

    inspectionAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    // Pricing
    askingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    pricePerGram: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "NGN"], // Only USD and Naira
    },

    // Exchange rate for currency conversion
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0,
    },

    minimumOrderKg: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Status Management
    status: {
      type: String,
      enum: [
        "pending_approval",
        "available",
        "reserved",
        "negotiation",
        "sold",
        "delivered",
        "archived",
        "rejected",
      ],
      default: "pending_approval",
      index: true,
    },

    // Quality and Certification
    qualityCertificate: {
      type: String,
    },

    assayReport: {
      type: String,
    },

    photos: [
      {
        url: String,
        caption: String,
        uploadedAt: Date,
      },
    ],

    // Supporting Documents
    documents: [
      {
        name: String,
        url: String,
        type: String,
        uploadedAt: Date,
      },
    ],

    // Approval Workflow
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    rejectionReason: {
      type: String,
      default: "",
    },

    // Sales and Transaction Info
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    soldAt: Date,

    finalPrice: {
      type: Number,
      min: 0,
    },

    finalPriceCurrency: {
      type: String,
      enum: ["USD", "NGN"],
      default: "USD",
    },

    // Expiry and Availability
    availableUntil: {
      type: Date,
      default: function() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      },
    },

    isExpired: {
      type: Boolean,
      default: false,
    },

    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    notes: {
      type: String,
      default: "",
    },

    // Soft Delete
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
inventorySchema.index({ supplier: 1, status: 1 });
inventorySchema.index({ purity: -1, weightKg: -1 });
inventorySchema.index({ askingPrice: 1, pricePerGram: 1 });
inventorySchema.index({ location: 1, status: 1 });
inventorySchema.index({ createdAt: -1 });
inventorySchema.index({ availableUntil: 1, status: 1 });

// ==================== VIRTUAL FIELDS ====================

// Total value (available weight * asking price)
inventorySchema.virtual("totalValue").get(function() {
  return this.availableWeightKg * this.askingPrice;
});

// Total value in USD (for reporting)
inventorySchema.virtual("totalValueInUSD").get(function() {
  if (this.currency === "USD") return this.totalValue;
  const rate = this.exchangeRate || 1500;
  return this.totalValue / rate;
});

// Total value in Naira (for reporting)
inventorySchema.virtual("totalValueInNGN").get(function() {
  if (this.currency === "NGN") return this.totalValue;
  const rate = this.exchangeRate || 1500;
  return this.totalValue * rate;
});

// Percent available
inventorySchema.virtual("percentAvailable").get(function() {
  if (this.weightKg === 0) return 0;
  return ((this.availableWeightKg / this.weightKg) * 100).toFixed(2);
});

// Formatted price with currency
inventorySchema.virtual("formattedPrice").get(function() {
  const currency = this.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(this.askingPrice || 0);
  } catch (error) {
    return `${this.currency || "USD"} ${this.askingPrice || 0}`;
  }
});

// Formatted price per gram with currency
inventorySchema.virtual("formattedPricePerGram").get(function() {
  const currency = this.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(this.pricePerGram || 0);
  } catch (error) {
    return `${this.currency || "USD"} ${this.pricePerGram || 0}`;
  }
});

// Formatted total value with currency
inventorySchema.virtual("formattedTotalValue").get(function() {
  const currency = this.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(this.totalValue || 0);
  } catch (error) {
    return `${this.currency || "USD"} ${this.totalValue || 0}`;
  }
});

// ==================== PRE-SAVE MIDDLEWARE ====================
inventorySchema.pre("save", function() {
  try {
    // Calculate price per gram
    if (this.weightKg > 0 && this.askingPrice > 0) {
      this.pricePerGram = this.askingPrice / (this.weightKg * 1000);
    }
    
    // Set default exchange rate if not set
    if (!this.exchangeRate) {
      this.exchangeRate = this.currency === "USD" ? 1 : 1500;
    }
    
    // Generate inventory number if not exists
    if (!this.inventoryNumber) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      this.inventoryNumber = `INV-${year}${month}-${random}`;
    }
    
  } catch (error) {
    console.log(error)
  }
});

// ==================== STATIC METHODS ====================

// Get available inventory
inventorySchema.statics.getAvailableInventory = async function(filters = {}) {
  const query = {
    status: "available",
    isActive: true,
    availableWeightKg: { $gt: 0 },
    isExpired: false,
    availableUntil: { $gt: new Date() },
    ...filters,
  };
  
  return this.find(query)
    .populate("supplier", "fullName email phone profile")
    .sort("-createdAt");
};

// Get inventory summary
inventorySchema.statics.getSummary = async function() {
  const summary = await this.aggregate([
    {
      $match: {
        isActive: true,
        status: { $ne: "archived" },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalWeight: { $sum: "$availableWeightKg" },
        totalValue: { $sum: { $multiply: ["$availableWeightKg", "$askingPrice"] } },
      },
    },
  ]);
  
  return summary;
};

// Get inventory summary by currency
inventorySchema.statics.getSummaryByCurrency = async function() {
  const summary = await this.aggregate([
    {
      $match: {
        isActive: true,
        status: { $ne: "archived" },
      },
    },
    {
      $group: {
        _id: "$currency",
        count: { $sum: 1 },
        totalWeight: { $sum: "$availableWeightKg" },
        totalValue: { $sum: { $multiply: ["$availableWeightKg", "$askingPrice"] } },
      },
    },
  ]);
  
  return summary;
};

// Get inventory by currency
inventorySchema.statics.getByCurrency = async function(currency) {
  return this.find({
    currency: currency,
    isActive: true,
    status: "available",
  }).populate("supplier", "fullName email phone profile");
};

// ==================== INSTANCE METHODS ====================

// Reserve inventory
inventorySchema.methods.reserve = async function(quantity, userId) {
  if (this.availableWeightKg < quantity) {
    throw new Error(`Insufficient inventory. Available: ${this.availableWeightKg}kg`);
  }
  
  this.availableWeightKg -= quantity;
  this.updatedBy = userId;
  
  if (this.availableWeightKg === 0) {
    this.status = "reserved";
  }
  
  await this.save();
  return this;
};

// Release reserved inventory
inventorySchema.methods.release = async function(quantity, userId) {
  this.availableWeightKg += quantity;
  this.updatedBy = userId;
  
  if (this.status === "reserved" && this.availableWeightKg > 0) {
    this.status = "available";
  }
  
  await this.save();
  return this;
};

// Mark as sold
inventorySchema.methods.markAsSold = async function(buyerId, finalPrice, currency, userId) {
  this.status = "sold";
  this.buyer = buyerId;
  this.finalPrice = finalPrice || this.askingPrice;
  this.finalPriceCurrency = currency || this.currency;
  this.soldAt = new Date();
  this.updatedBy = userId;
  
  await this.save();
  return this;
};

module.exports = mongoose.model("Inventory", inventorySchema);
const mongoose = require("mongoose");

const rfqSchema = new mongoose.Schema(
  {
    // Tracking
    rfqNumber: {
      type: String,
      unique: true,
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    buyerProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerProfile",
    },

    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    requestedWeightKg: {
      type: Number,
      required: true,
      min: 0.01,
    },

    offeredPricePerKg: {
      type: Number,
      required: true,
      min: 0,
    },

    offeredTotalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["USD", "NGN"], // Only USD and Naira
      default: "USD",
    },

    // Exchange rate for currency conversion tracking
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0,
    },

    requiredPurity: {
      type: Number,
      min: 0,
      max: 100,
    },

    qualityAssay: {
      type: Boolean,
      default: false,
    },

    deliveryTerms: {
      type: String,
      enum: ["ex_works", "fob", "cif", "door_delivery", "negotiable"],
      default: "negotiable",
    },

    preferredLocation: {
      type: String,
    },

    inspectionRequired: {
      type: Boolean,
      default: true,
    },

    inspectionDetails: {
      location: String,
      date: Date,
      notes: String,
    },

    validUntil: {
      type: Date,
      required: true,
      default: function() {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date;
      },
    },

    preferredDeliveryDate: Date,

    message: {
      type: String,
      maxlength: 1000,
    },

    attachments: [
      {
        name: String,
        url: String,
        type: String,
        uploadedAt: Date,
      },
    ],

    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "under_review",
        "quoted",
        "negotiation",
        "accepted",
        "rejected",
        "expired",
        "closed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    quotePricePerKg: {
      type: Number,
      min: 0,
    },

    quoteTotalPrice: {
      type: Number,
      min: 0,
    },

    finalPricePerKg: {
      type: Number,
      min: 0,
    },

    finalTotalPrice: {
      type: Number,
      min: 0,
    },

    // Track currency for quotes and final prices
    quoteCurrency: {
      type: String,
      enum: ["USD", "NGN"],
      default: "USD",
    },

    finalCurrency: {
      type: String,
      enum: ["USD", "NGN"],
      default: "USD",
    },

    negotiationHistory: [
      {
        round: {
          type: Number,
          default: 1,
        },
        pricePerKg: Number,
        totalPrice: Number,
        message: String,
        proposedBy: {
          type: String,
          enum: ["buyer", "staff", "supplier"],
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        currency: {
          type: String,
          enum: ["USD", "NGN"],
          default: "USD",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    staffResponse: {
      type: String,
    },

    staffNotes: {
      type: String,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reviewedAt: Date,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    responseHistory: [
      {
        action: {
          type: String,
          enum: ["created", "updated", "quoted", "negotiated", "accepted", "rejected", "expired", "cancelled"],
        },
        message: String,
        price: Number,
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    appointmentScheduled: {
      type: Boolean,
      default: false,
    },

    appointment: {
      date: Date,
      location: String,
      type: {
        type: String,
        enum: ["inspection", "negotiation", "closing"],
      },
      meetingLink: String,
      notes: String,
      status: {
        type: String,
        enum: ["scheduled", "confirmed", "completed", "cancelled"],
        default: "scheduled",
      },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

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
rfqSchema.index({ buyer: 1, status: 1 });
rfqSchema.index({ supplier: 1, status: 1 });
rfqSchema.index({ status: 1, validUntil: 1 });
rfqSchema.index({ createdAt: -1 });
rfqSchema.index({ currency: 1 });

// ==================== VIRTUAL FIELDS ====================

// Safe virtual for formatted total value
rfqSchema.virtual("formattedTotalValue").get(function() {
  const currency = this.currency || "USD";
  const amount = this.offeredTotalPrice || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  } catch (error) {
    return `${currency} ${amount}`;
  }
});

// Total value in USD (for reporting)
rfqSchema.virtual("totalValueInUSD").get(function() {
  if (this.currency === "USD") return this.offeredTotalPrice || 0;
  const rate = this.exchangeRate || 1500;
  return (this.offeredTotalPrice || 0) / rate;
});

// Total value in Naira (for reporting)
rfqSchema.virtual("totalValueInNGN").get(function() {
  if (this.currency === "NGN") return this.offeredTotalPrice || 0;
  const rate = this.exchangeRate || 1500;
  return (this.offeredTotalPrice || 0) * rate;
});

// Formatted quote price
rfqSchema.virtual("formattedQuotePrice").get(function() {
  if (!this.quotePricePerKg) return null;
  const currency = this.quoteCurrency || this.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(this.quotePricePerKg);
  } catch (error) {
    return `${currency} ${this.quotePricePerKg}`;
  }
});

// Formatted final price
rfqSchema.virtual("formattedFinalPrice").get(function() {
  if (!this.finalPricePerKg) return null;
  const currency = this.finalCurrency || this.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(this.finalPricePerKg);
  } catch (error) {
    return `${currency} ${this.finalPricePerKg}`;
  }
});

// Check if RFQ is expired
rfqSchema.virtual("isExpired").get(function() {
  return this.validUntil && new Date() > this.validUntil && this.status !== "accepted";
});

// ==================== PRE-SAVE MIDDLEWARE ====================
rfqSchema.pre("save", async function() {
  try {
    // Generate RFQ number if not exists
    if (!this.rfqNumber) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const count = await mongoose.model("RFQ").countDocuments();
      const sequence = String(count + 1).padStart(6, "0");
      this.rfqNumber = `RFQ-${year}${month}-${sequence}`;
    }

    // Calculate total price
    if (this.requestedWeightKg && this.offeredPricePerKg) {
      this.offeredTotalPrice = this.requestedWeightKg * this.offeredPricePerKg;
    }

    if (this.quotePricePerKg && this.requestedWeightKg) {
      this.quoteTotalPrice = this.requestedWeightKg * this.quotePricePerKg;
    }

    // Set default exchange rate if not set
    if (!this.exchangeRate) {
      this.exchangeRate = this.currency === "USD" ? 1 : 1500;
    }

    // Auto-expire logic
    if (this.validUntil && new Date() > this.validUntil && this.status === "pending") {
      this.status = "expired";
      this.addToHistory("expired", "RFQ expired due to time limit");
    }

  } catch (error) {
    console.error("RFQ pre-save error:", error);
  
  }
});

// ==================== METHODS ====================
rfqSchema.methods.addToHistory = function(action, message, price = null, userId = null) {
  this.responseHistory.push({
    action,
    message,
    price,
    by: userId || this.reviewedBy,
    date: new Date(),
  });
};

rfqSchema.methods.addNegotiation = async function(pricePerKg, message, proposedBy, userId, currency = null) {
  this.negotiationHistory.push({
    round: this.negotiationHistory.length + 1,
    pricePerKg,
    totalPrice: pricePerKg * this.requestedWeightKg,
    message,
    proposedBy,
    userId,
    currency: currency || this.currency || "USD",
    createdAt: new Date(),
  });

  this.status = "negotiation";
  this.addToHistory("negotiated", message, pricePerKg, userId);
  await this.save();
};

rfqSchema.methods.accept = async function(userId) {
  this.status = "accepted";
  this.finalPricePerKg = this.negotiationHistory.length > 0 
    ? this.negotiationHistory[this.negotiationHistory.length - 1].pricePerKg 
    : this.quotePricePerKg || this.offeredPricePerKg;
  
  this.finalTotalPrice = this.finalPricePerKg * this.requestedWeightKg;
  this.finalCurrency = this.currency || "USD";
  this.reviewedBy = userId;
  this.reviewedAt = new Date();
  this.addToHistory("accepted", "RFQ accepted", this.finalPricePerKg, userId);
  await this.save();
};

rfqSchema.methods.reject = async function(reason, userId) {
  this.status = "rejected";
  this.staffResponse = reason;
  this.reviewedBy = userId;
  this.reviewedAt = new Date();
  this.addToHistory("rejected", reason, null, userId);
  await this.save();
};

// ==================== STATIC METHODS ====================
rfqSchema.statics.getPendingRFQs = async function() {
  return this.find({
    status: { $in: ["pending", "under_review"] },
    validUntil: { $gt: new Date() },
    isActive: true,
  })
    .populate("buyer", "fullName email phone")
    .populate("supplier", "fullName email")
    .populate("inventory", "weightKg purity askingPrice location")
    .sort("-createdAt");
};

rfqSchema.statics.getRFQSummary = async function() {
  const summary = await this.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalValue: { $sum: "$offeredTotalPrice" },
        totalWeight: { $sum: "$requestedWeightKg" },
      },
    },
  ]);
  return summary;
};

rfqSchema.statics.getRFQSummaryByCurrency = async function() {
  const summary = await this.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $group: {
        _id: "$currency",
        count: { $sum: 1 },
        totalValue: { $sum: "$offeredTotalPrice" },
        totalWeight: { $sum: "$requestedWeightKg" },
      },
    },
  ]);
  return summary;
};

rfqSchema.statics.getByCurrency = async function(currency) {
  return this.find({
    currency: currency,
    isActive: true,
  })
    .populate("buyer", "fullName email phone")
    .populate("supplier", "fullName email")
    .populate("inventory", "weightKg purity askingPrice location")
    .sort("-createdAt");
};



module.exports = mongoose.model("RFQ", rfqSchema);
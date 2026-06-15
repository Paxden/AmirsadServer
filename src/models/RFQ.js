const mongoose = require("mongoose");

const rfqSchema = new mongoose.Schema(
  {
    // Tracking
    rfqNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    // Buyer Information
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

    // Inventory/Seller Information
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

    // RFQ Details
    requestedWeightKg: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: function(value) {
          return value <= this.inventory?.availableWeightKg;
        },
        message: "Requested weight exceeds available inventory",
      },
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
      enum: ["USD", "EUR", "GBP", "AED"],
      default: "USD",
    },

    // Purity and Quality Requirements
    requiredPurity: {
      type: Number,
      min: 0,
      max: 100,
    },

    qualityAssay: {
      type: Boolean,
      default: false,
    },

    // Delivery Preferences
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

    // Timeline
    validUntil: {
      type: Date,
      required: true,
      default: function() {
        const date = new Date();
        date.setDate(date.getDate() + 7); // Valid for 7 days
        return date;
      },
    },

    preferredDeliveryDate: Date,

    // Communication
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

    // Status Management
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
      default: "draft",
      index: true,
    },

    // Pricing and Negotiation
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
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Staff Handling
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

    // Response History (for tracking)
    responseHistory: [
      {
        action: {
          type: String,
          enum: ["created", "updated", "quoted", "negotiated", "accepted", "rejected", "expired"],
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

    // Appointment/Meeting
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

    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// Indexes
// rfqSchema.index({ rfqNumber: 1 });
rfqSchema.index({ buyer: 1, status: 1 });
rfqSchema.index({ supplier: 1, status: 1 });
rfqSchema.index({ status: 1, validUntil: 1 });
rfqSchema.index({ createdAt: -1 });
rfqSchema.index({ "negotiationHistory.createdAt": -1 });

// Virtuals
rfqSchema.virtual("isExpired").get(function() {
  return this.validUntil && new Date() > this.validUntil && this.status !== "accepted";
});

rfqSchema.virtual("totalValueFormatted").get(function() {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: this.currency,
  }).format(this.offeredTotalPrice);
});

rfqSchema.virtual("quoteValueFormatted").get(function() {
  if (!this.quoteTotalPrice) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: this.currency,
  }).format(this.quoteTotalPrice);
});

rfqSchema.virtual("negotiationRound").get(function() {
  return this.negotiationHistory.length;
});

// Pre-save Middleware
rfqSchema.pre("save", async function(next) {
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

  // Auto-expire logic
  if (this.validUntil && new Date() > this.validUntil && this.status === "pending") {
    this.status = "expired";
    this.addToHistory("expired", "RFQ expired due to time limit");
  }

  next();
});

// Methods
rfqSchema.methods.addToHistory = function(action, message, price = null, userId = null) {
  this.responseHistory.push({
    action,
    message,
    price,
    by: userId || this.reviewedBy,
    date: new Date(),
  });
};

rfqSchema.methods.addNegotiation = async function(pricePerKg, message, proposedBy, userId) {
  this.negotiationHistory.push({
    round: this.negotiationHistory.length + 1,
    pricePerKg,
    totalPrice: pricePerKg * this.requestedWeightKg,
    message,
    proposedBy,
    userId,
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

// Static Methods
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

module.exports = mongoose.model("RFQ", rfqSchema);
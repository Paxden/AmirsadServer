const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema(
  {
    dealNumber: {
      type: String,
      unique: true,
      index: true,
    },

    // Core Entities
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },

    rfq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      required: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Deal Specifications
    quantityKg: {
      type: Number,
      required: true,
      min: 0.01,
    },

    agreedPricePerKg: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "NGN"], // Only USD and Naira
    },

    purity: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Exchange Rate (for currency conversion tracking)
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0,
    },

    // Enhanced Deal Status Flow
    status: {
      type: String,
      enum: [
        "open",
        "inspection_scheduled",
        "inspection_completed",
        "inspection_passed",
        "inspection_failed",
        "offer_made",
        "offer_received",
        "offer_accepted",
        "offer_rejected",
        "agreement_signed",
        "payment_pending",
        "payment_received",
        "delivery_scheduled",
        "delivery_completed",
        "closed",
        "cancelled",
        "disputed",
      ],
      default: "open",
      index: true,
    },

    // Status History
    statusHistory: [
      {
        status: String,
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],

    // Inspection Details
    inspection: {
      scheduledDate: Date,
      completedDate: Date,
      inspector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      report: String,
      passed: Boolean,
      notes: String,
      documents: [
        {
          name: String,
          url: String,
          uploadedAt: Date,
        },
      ],
    },

    // Offer/Negotiation Details
    offerHistory: [
      {
        amount: Number,
        pricePerKg: Number,
        proposedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        proposedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected", "countered"],
        },
        notes: String,
      },
    ],

    finalOffer: {
      amount: Number,
      pricePerKg: Number,
      acceptedAt: Date,
      acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },

    // Agreement/Contract
    agreement: {
      signedAt: Date,
      signedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      documentUrl: String,
      terms: String,
    },

    // Payment Tracking
    payment: {
      status: {
        type: String,
        enum: ["pending", "partial", "paid", "overdue", "refunded"],
        default: "pending",
      },
      dueDate: Date,
      paidAt: Date,
      amount: Number,
      currency: {
        type: String,
        enum: ["USD", "NGN"],
        default: "USD",
      },
      reference: String,
      method: {
        type: String,
        enum: ["bank_transfer", "wire", "crypto", "cash"],
      },
      transactions: [
        {
          amount: Number,
          currency: {
            type: String,
            enum: ["USD", "NGN"],
            default: "USD",
          },
          date: Date,
          reference: String,
          notes: String,
        },
      ],
    },

    // Delivery Tracking
    delivery: {
      scheduledDate: Date,
      completedDate: Date,
      method: {
        type: String,
        enum: ["pickup", "courier", "armored", "air_freight"],
      },
      trackingNumber: String,
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
      documents: [
        {
          name: String,
          url: String,
        },
      ],
      notes: String,
    },

    // Quality Assurance
    qualityReport: {
      certificateNumber: String,
      issuedBy: String,
      issuedAt: Date,
      documents: [String],
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },

    // Commission/Fees
    platformFee: {
      amount: Number,
      percentage: Number,
      currency: {
        type: String,
        enum: ["USD", "NGN"],
        default: "USD",
      },
      paid: {
        type: Boolean,
        default: false,
      },
      paidAt: Date,
    },

    // Ratings & Feedback
    supplierRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      feedback: String,
      ratedAt: Date,
    },

    buyerRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      feedback: String,
      ratedAt: Date,
    },

    // Dispute Resolution
    dispute: {
      raisedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      raisedAt: Date,
      reason: String,
      description: String,
      status: {
        type: String,
        enum: ["open", "under_review", "resolved", "rejected"],
      },
      resolution: String,
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },

    // Documents
    documents: [
      {
        type: {
          type: String,
          enum: ["agreement", "invoice", "certificate", "report", "other"],
        },
        name: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Timeline Summary
    timeline: {
      openedAt: {
        type: Date,
        default: Date.now,
      },
      inspectionAt: Date,
      offerAt: Date,
      agreementAt: Date,
      paymentAt: Date,
      deliveryAt: Date,
      closedAt: Date,
    },

    // Audit
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
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
dealSchema.index({ supplier: 1, status: 1 });
dealSchema.index({ buyer: 1, status: 1 });
dealSchema.index({ status: 1, createdAt: -1 });
dealSchema.index({ "timeline.closedAt": 1 });

// ==================== VIRTUAL FIELDS ====================

// Formatted total based on currency
dealSchema.virtual("formattedTotal").get(function () {
  const currency = this.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(this.totalAmount || 0);
  } catch (error) {
    return `${this.currency || "USD"} ${this.totalAmount || 0}`;
  }
});

// Formatted total in USD (for reporting)
dealSchema.virtual("totalInUSD").get(function () {
  if (this.currency === "USD") return this.totalAmount;
  // Approximate conversion rate - you can make this configurable
  const exchangeRate = this.exchangeRate || 1500; // ₦ to USD
  return this.totalAmount / exchangeRate;
});

// Formatted total in Naira (for reporting)
dealSchema.virtual("totalInNGN").get(function () {
  if (this.currency === "NGN") return this.totalAmount;
  const exchangeRate = this.exchangeRate || 1500; // USD to ₦
  return this.totalAmount * exchangeRate;
});

// Formatted price per kg based on currency
dealSchema.virtual("formattedPricePerKg").get(function () {
  const currency = this.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(this.agreedPricePerKg || 0);
  } catch (error) {
    return `${this.currency || "USD"} ${this.agreedPricePerKg || 0}`;
  }
});

dealSchema.virtual("daysOpen").get(function () {
  const startDate = this.timeline.openedAt || this.createdAt;
  const endDate = this.timeline.closedAt || new Date();
  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
});

dealSchema.virtual("currentStage").get(function () {
  const stages = {
    open: "Initial",
    inspection_scheduled: "Inspection",
    inspection_completed: "Quality Check",
    offer_made: "Negotiation",
    offer_accepted: "Agreement",
    agreement_signed: "Contract",
    payment_pending: "Payment",
    delivery_scheduled: "Delivery",
    closed: "Completed",
  };
  return stages[this.status] || this.status;
});

// ==================== PRE-SAVE MIDDLEWARE ====================
dealSchema.pre("save", async function () {
  try {
    // Generate deal number if not exists
    if (!this.dealNumber) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const count = await mongoose.model("Deal").countDocuments();
      const sequence = String(count + 1).padStart(6, "0");
      this.dealNumber = `DL-${year}${month}-${sequence}`;
    }

    // Calculate total amount
    if (this.quantityKg && this.agreedPricePerKg) {
      this.totalAmount = this.quantityKg * this.agreedPricePerKg;
    }

    // Set default exchange rate if not set
    if (!this.exchangeRate) {
      this.exchangeRate = this.currency === "USD" ? 1 : 1500;
    }

    // Update timeline based on status
    if (this.isModified("status")) {
      this.statusHistory.push({
        status: this.status,
        changedBy: this.updatedBy || this.createdBy,
      });

      // Update timeline dates
      if (this.status === "inspection_scheduled" && !this.timeline.inspectionAt) {
        this.timeline.inspectionAt = new Date();
      }
      if (this.status === "offer_made" && !this.timeline.offerAt) {
        this.timeline.offerAt = new Date();
      }
      if (this.status === "agreement_signed" && !this.timeline.agreementAt) {
        this.timeline.agreementAt = new Date();
      }
      if (this.status === "payment_received" && !this.timeline.paymentAt) {
        this.timeline.paymentAt = new Date();
      }
      if (this.status === "delivery_completed" && !this.timeline.deliveryAt) {
        this.timeline.deliveryAt = new Date();
      }
      if (this.status === "closed" && !this.timeline.closedAt) {
        this.timeline.closedAt = new Date();
      }
    }

  } catch (error) {
    console.log(error)
  }
});

// ==================== METHODS ====================
dealSchema.methods.updateStatus = async function (newStatus, userId, notes) {
  const oldStatus = this.status;
  this.status = newStatus;
  this.updatedBy = userId;

  await this.save();

  // Log activity
  await mongoose.model("Activity").logActivity({
    user: userId,
    deal: this._id,
    action: "STATUS_CHANGE",
    description: `Deal status changed from ${oldStatus} to ${newStatus}`,
    metadata: { oldStatus, newStatus, notes },
  });

  return this;
};

dealSchema.methods.addOffer = async function (offer, userId) {
  this.offerHistory.push({
    ...offer,
    proposedBy: userId,
  });

  this.status = "offer_made";
  this.updatedBy = userId;
  await this.save();

  return this;
};

dealSchema.methods.acceptOffer = async function (userId) {
  const lastOffer = this.offerHistory[this.offerHistory.length - 1];
  if (lastOffer) {
    this.finalOffer = {
      amount: lastOffer.amount,
      pricePerKg: lastOffer.pricePerKg,
      acceptedAt: new Date(),
      acceptedBy: userId,
    };
    this.status = "offer_accepted";
    await this.save();
  }
  return this;
};

dealSchema.methods.completeInspection = async function (inspectionData, userId) {
  this.inspection = {
    ...this.inspection,
    ...inspectionData,
    completedDate: new Date(),
  };

  this.status = inspectionData.passed ? "inspection_passed" : "inspection_failed";
  this.updatedBy = userId;
  await this.save();

  return this;
};

// ==================== STATIC METHODS ====================
dealSchema.statics.getDealSummary = async function () {
  const summary = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalValue: { $sum: "$totalAmount" },
        totalWeight: { $sum: "$quantityKg" },
      },
    },
  ]);
  return summary;
};

dealSchema.statics.getDealSummaryByCurrency = async function () {
  const summary = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$currency",
        count: { $sum: 1 },
        totalValue: { $sum: "$totalAmount" },
        totalWeight: { $sum: "$quantityKg" },
      },
    },
  ]);
  return summary;
};

dealSchema.statics.getSupplierDashboard = async function (supplierId) {
  const deals = await this.find({ supplier: supplierId, isActive: true });

  return {
    totalDeals: deals.length,
    activeDeals: deals.filter((d) => !["closed", "cancelled"].includes(d.status)).length,
    completedDeals: deals.filter((d) => d.status === "closed").length,
    totalValue: deals.reduce((sum, d) => sum + d.totalAmount, 0),
    byStatus: deals.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {}),
  };
};

module.exports = mongoose.model("Deal", dealSchema);
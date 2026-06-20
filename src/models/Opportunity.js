const mongoose = require("mongoose");

const opportunitySchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    supplierProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProfile",
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    goldType: {
      type: String,
      enum: [
        "refined",
        "doré",
        "scrap",
        "bars",
        "nuggets",
        "gold_dore",
        "gold_bar",
        "gold_nugget",
        "gold_dust",
        "raw_gold",
      ],
      default: "refined",
    },

    form: {
      type: String,
      enum: ["bars", "coins", "granules", "powder", "other"],
      default: "bars",
    },

    location: {
      type: String,
      required: true,
    },

    weightKg: {
      type: Number,
      required: true,
      min: 0.01,
    },

    purity: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    askingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "NGN"], // Only USD and Naira
    },

    // Exchange rate for currency conversion tracking
    exchangeRate: {
      type: Number,
      default: 1,
      min: 0,
    },

    description: {
      type: String,
      default: "",
    },

    photos: [
      {
        url: String,
        caption: String,
      },
    ],

    documents: [
      {
        name: String,
        url: String,
      },
    ],

    status: {
      type: String,
      enum: ["draft", "pending", "under_review", "inspection", "approved", "rejected", "expired"],
      default: "pending",
    },

    inspectionDate: Date,

    reviewNote: String,
    rejectionReason: String,

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,

    createdBy: {
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

// ==================== INDEXES ====================
opportunitySchema.index({ supplier: 1, status: 1 });
opportunitySchema.index({ createdAt: -1 });
opportunitySchema.index({ currency: 1 });
opportunitySchema.index({ status: 1, createdAt: -1 });

// ==================== VIRTUAL FIELDS ====================

// Total value (weight * asking price)
opportunitySchema.virtual("totalValue").get(function() {
  return this.weightKg * this.askingPrice;
});

// Total value in USD (for reporting)
opportunitySchema.virtual("totalValueInUSD").get(function() {
  if (this.currency === "USD") return this.totalValue;
  const rate = this.exchangeRate || 1500;
  return this.totalValue / rate;
});

// Total value in Naira (for reporting)
opportunitySchema.virtual("totalValueInNGN").get(function() {
  if (this.currency === "NGN") return this.totalValue;
  const rate = this.exchangeRate || 1500;
  return this.totalValue * rate;
});

// Formatted price with currency
opportunitySchema.virtual("formattedPrice").get(function() {
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

// Formatted total value with currency
opportunitySchema.virtual("formattedTotalValue").get(function() {
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

// Formatted weight with unit
opportunitySchema.virtual("formattedWeight").get(function() {
  return `${this.weightKg} kg`;
});

// Status label
opportunitySchema.virtual("statusLabel").get(function() {
  const labels = {
    draft: "Draft",
    pending: "Pending Review",
    under_review: "Under Review",
    inspection: "Inspection",
    approved: "Approved",
    rejected: "Rejected",
    expired: "Expired",
  };
  return labels[this.status] || this.status;
});

// ==================== PRE-SAVE MIDDLEWARE ====================
opportunitySchema.pre("save", function() {
  try {
    // Set default exchange rate if not set
    if (!this.exchangeRate) {
      this.exchangeRate = this.currency === "USD" ? 1 : 1500;
    }
    
  } catch (error) {
    console.log(error);
  }
});

// ==================== METHODS ====================

// Check if opportunity can be submitted
opportunitySchema.methods.canSubmit = function() {
  return this.status === "draft" || this.status === "rejected";
};

// Submit opportunity (change status to pending)
opportunitySchema.methods.submit = async function(userId) {
  if (!this.canSubmit()) {
    throw new Error(`Cannot submit opportunity with status: ${this.status}`);
  }
  this.status = "pending";
  this.createdBy = userId;
  await this.save();
  return this;
};

// Approve opportunity
opportunitySchema.methods.approve = async function(userId, notes) {
  if (this.status !== "pending" && this.status !== "under_review") {
    throw new Error(`Cannot approve opportunity with status: ${this.status}`);
  }
  this.status = "approved";
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.reviewNote = notes || this.reviewNote;
  await this.save();
  return this;
};

// Reject opportunity
opportunitySchema.methods.reject = async function(userId, reason) {
  if (this.status !== "pending" && this.status !== "under_review") {
    throw new Error(`Cannot reject opportunity with status: ${this.status}`);
  }
  this.status = "rejected";
  this.reviewedBy = userId;
  this.rejectionReason = reason;
  await this.save();
  return this;
};

// ==================== STATIC METHODS ====================

// Get opportunities by status
opportunitySchema.statics.getByStatus = async function(status) {
  return this.find({ status })
    .populate("supplier", "fullName email phone")
    .sort("-createdAt");
};

// Get pending opportunities (for admin review)
opportunitySchema.statics.getPending = async function() {
  return this.find({
    status: { $in: ["pending", "under_review"] }
  })
    .populate("supplier", "fullName email phone profile")
    .sort("-createdAt");
};

// Get opportunities by currency
opportunitySchema.statics.getByCurrency = async function(currency) {
  return this.find({
    currency: currency,
    status: { $in: ["approved", "pending"] }
  })
    .populate("supplier", "fullName email phone")
    .sort("-createdAt");
};

// Get opportunity statistics
opportunitySchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalWeight: { $sum: "$weightKg" },
        totalValue: { $sum: { $multiply: ["$weightKg", "$askingPrice"] } },
      },
    },
  ]);
  return stats;
};

// Get opportunity statistics by currency
opportunitySchema.statics.getStatsByCurrency = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$currency",
        count: { $sum: 1 },
        totalWeight: { $sum: "$weightKg" },
        totalValue: { $sum: { $multiply: ["$weightKg", "$askingPrice"] } },
      },
    },
  ]);
  return stats;
};

// Get supplier opportunities with stats
opportunitySchema.statics.getSupplierOpportunities = async function(supplierId) {
  const opportunities = await this.find({
    supplier: supplierId,
    status: { $ne: "draft" }
  })
    .sort("-createdAt");
  
  const stats = {
    total: opportunities.length,
    pending: opportunities.filter(o => o.status === "pending").length,
    approved: opportunities.filter(o => o.status === "approved").length,
    rejected: opportunities.filter(o => o.status === "rejected").length,
    totalWeight: opportunities.reduce((sum, o) => sum + o.weightKg, 0),
    totalValue: opportunities.reduce((sum, o) => sum + (o.weightKg * o.askingPrice), 0),
  };
  
  return { opportunities, stats };
};

module.exports = mongoose.model("Opportunity", opportunitySchema);
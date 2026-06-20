const mongoose = require("mongoose");

const buyerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Company Information
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    registrationNumber: {
      type: String,
      default: "",
      trim: true,
    },

    taxId: {
      type: String,
      default: "",
      trim: true,
    },

    country: {
      type: String,
      default: "",
      index: true,
    },

    city: {
      type: String,
      default: "",
    },

    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },

    // Buyer Classification
    buyerType: {
      type: String,
      enum: ["refinery", "trader", "investor", "bank", "jeweler", "other"],
      default: "trader",
      index: true,
    },

    // Annual Purchase Capacity
    annualPurchaseCapacity: {
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        enum: ["USD", "NGN"], // Only USD and Naira
        default: "USD",
      },
    },

    preferredGoldTypes: [
      {
        type: String,
        enum: ["doré", "refined", "scrap", "bars", "nuggets", "all"],
      },
    ],

    preferredPurityRange: {
      min: {
        type: Number,
        min: 0,
        max: 100,
        default: 90,
      },
      max: {
        type: Number,
        min: 0,
        max: 100,
        default: 99.99,
      },
    },

    preferredWeightRange: {
      minKg: {
        type: Number,
        min: 0,
        default: 0,
      },
      maxKg: {
        type: Number,
        min: 0,
        default: 1000,
      },
    },

    // KYC and Verification
    kycStatus: {
      type: String,
      enum: [
        "not_submitted",
        "pending",
        "under_review",
        "approved",
        "rejected",
      ],
      default: "not_submitted",
      index: true,
    },

    kycLevel: {
      type: String,
      enum: ["basic", "enhanced", "premium"],
      default: "basic",
    },

    kycSubmittedAt: Date,
    kycApprovedAt: Date,

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    verificationNotes: String,
    rejectionReason: String,

    // Financial Information
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    creditLimitCurrency: {
      type: String,
      enum: ["USD", "NGN"],
      default: "USD",
    },

    paymentTerms: {
      type: String,
      enum: ["advance", "lc", "dpc", "net_30", "net_60", "negotiable"],
      default: "negotiable",
    },

    bankDetails: {
      bankName: String,
      accountName: String,
      accountNumber: String,
      swiftCode: String,
      iban: String,
      // Naira specific fields
      bankCode: String,
      nuban: String,
    },

    // Trading Preferences
    preferredCurrencies: [
      {
        type: String,
        enum: ["USD", "NGN"],
        default: "USD",
      },
    ],

    preferredLocations: [
      {
        type: String,
        default: [],
      },
    ],

    // Documents
    documents: [
      {
        documentType: {
          type: String,
          enum: [
            "passport",
            "id_card",
            "company_certificate",
            "proof_of_funds",
            "bank_reference",
            "trade_license",
            "vat_certificate",
            "other",
          ],
          required: true,
        },
        fileUrl: {
          type: String,
          required: true,
        },
        fileName: String,
        fileSize: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        verified: {
          type: Boolean,
          default: false,
        },
        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        verifiedAt: Date,
      },
    ],

    // Trading History
    totalPurchased: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalSpentCurrency: {
      type: String,
      enum: ["USD", "NGN"],
      default: "USD",
    },

    averagePurchaseSize: {
      type: Number,
      default: 0,
    },

    completedTransactions: {
      type: Number,
      default: 0,
    },

    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    // Preferences and Settings
    preferences: {
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
        newInventoryAlert: {
          type: Boolean,
          default: true,
        },
        priceDropAlert: {
          type: Boolean,
          default: false,
        },
      },
      autoApproval: {
        enabled: {
          type: Boolean,
          default: false,
        },
        maxAmount: {
          type: Number,
          default: 0,
        },
      },
    },

    // Contact Persons
    contactPersons: [
      {
        name: {
          type: String,
          required: true,
        },
        position: String,
        email: String,
        phone: String,
        isPrimary: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isBlacklisted: {
      type: Boolean,
      default: false,
    },

    blacklistReason: String,

    notes: {
      type: String,
      default: "",
    },

    tags: [
      {
        type: String,
        lowercase: true,
      },
    ],

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
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
buyerProfileSchema.index({ country: 1, buyerType: 1 });
buyerProfileSchema.index({ kycStatus: 1, isActive: 1 });
buyerProfileSchema.index({ totalPurchased: -1 });
buyerProfileSchema.index({ rating: -1 });

// Virtuals
buyerProfileSchema.virtual("fullAddress").get(function () {
  if (!this.address) return "";
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.postalCode,
    this.address.country,
  ].filter(Boolean);
  return parts.join(", ");
});

// Formatted credit limit based on currency
buyerProfileSchema.virtual("formattedCreditLimit").get(function () {
  const currency = this.creditLimitCurrency || "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(this.creditLimit);
});

// Formatted total spent based on currency
buyerProfileSchema.virtual("formattedTotalSpent").get(function () {
  const currency = this.totalSpentCurrency || "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(this.totalSpent);
});

// Formatted annual purchase capacity
buyerProfileSchema.virtual("formattedAnnualCapacity").get(function () {
  if (!this.annualPurchaseCapacity) return null;
  const currency = this.annualPurchaseCapacity.currency || "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(this.annualPurchaseCapacity.amount || 0);
});

// Naira to USD conversion helper (using approximate rate)
buyerProfileSchema.virtual("creditLimitInUSD").get(function () {
  if (this.creditLimitCurrency === "USD") return this.creditLimit;
  // Approximate conversion rate - you can make this configurable
  const nairaToUsdRate = 0.00065; // ~₦1500 to $1
  return this.creditLimit * nairaToUsdRate;
});

buyerProfileSchema.virtual("creditLimitInNGN").get(function () {
  if (this.creditLimitCurrency === "NGN") return this.creditLimit;
  const usdToNairaRate = 1500; // ~$1 to ₦1500
  return this.creditLimit * usdToNairaRate;
});

// Methods
buyerProfileSchema.methods.canPurchase = function (amount) {
  if (!this.isActive || this.isBlacklisted) return false;
  if (this.kycStatus !== "approved") return false;
  if (this.creditLimit > 0 && amount > this.creditLimit - this.totalSpent) {
    return false;
  }
  return true;
};

buyerProfileSchema.methods.updatePurchaseHistory = async function (amount, currency = "USD") {
  this.totalPurchased += amount;
  this.totalSpent += amount;
  this.totalSpentCurrency = currency;
  this.completedTransactions += 1;
  this.averagePurchaseSize = this.totalSpent / this.completedTransactions;
  await this.save();
};

// Static Methods
buyerProfileSchema.statics.findVerifiedBuyers = function (filters = {}) {
  const query = {
    kycStatus: "approved",
    isActive: true,
    isBlacklisted: false,
    ...filters,
  };
  return this.find(query).populate("user", "fullName email phone");
};

buyerProfileSchema.statics.getTopBuyers = async function (limit = 10) {
  return this.find({
    kycStatus: "approved",
    isActive: true,
    completedTransactions: { $gt: 0 },
  })
    .sort({ totalPurchased: -1 })
    .limit(limit)
    .populate("user", "fullName email");
};

buyerProfileSchema.statics.getKYCStatistics = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$kycStatus",
        count: { $sum: 1 },
      },
    },
  ]);
  return stats;
};

// Pre-save middleware
buyerProfileSchema.pre("save", function () {
  // Auto-update kycApprovedAt when status changes to approved
  if (this.isModified("kycStatus") && this.kycStatus === "approved") {
    this.kycApprovedAt = new Date();
  }
});

module.exports = mongoose.model("BuyerProfile", buyerProfileSchema);
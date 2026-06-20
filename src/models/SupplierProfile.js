const mongoose = require("mongoose");

const supplierProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true, // Add index for faster queries
    },

    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      index: true, // For searching suppliers by company name
    },

    registrationNumber: {
      type: String,
      default: "",
      unique: false, // Not unique unless you want it to be
      trim: true,
    },

    taxId: {
      type: String,
      default: "",
      trim: true,
    },

    // Contact Information
    contactPerson: {
      name: {
        type: String,
        default: "",
      },
      position: {
        type: String,
        default: "",
      },
      phone: {
        type: String,
        default: "",
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        default: "",
      },
    },

    // Business Details
    businessType: {
      type: String,
      enum: [
        "sole_proprietorship",
        "partnership",
        "limited_liability",
        "corporation",
        "other"
      ],
      default: "other",
    },

    yearEstablished: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
    },

    numberOfEmployees: {
      type: Number,
      min: 1,
    },

    annualTurnover: {
      type: String, // Or Number if you want to store actual values
      default: "",
    },

    // Address Information
    nationality: {
      type: String,
      default: "",
    },

    country: {
      type: String,
      required: [true, "Country is required"],
      default: "",
    },

    state: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      required: [true, "City is required"],
      default: "",
    },

    address: {
      type: String,
      required: [true, "Address is required"],
      default: "",
    },

    postalCode: {
      type: String,
      default: "",
    },

    // KYC Status
    kycStatus: {
      type: String,
      enum: [
        "pending",        // Not yet submitted
        "under_review",   // Submitted and being reviewed
        "approved",       // Verified and approved
        "rejected",       // Rejected - needs resubmission
        "expired"         // KYC expired, needs renewal
      ],
      default: "pending",
      index: true, // For filtering by status
    },

    kycLevel: {
      type: Number,
      enum: [0, 1, 2, 3], // Different verification levels
      default: 0,
      comment: "0: None, 1: Basic, 2: Intermediate, 3: Full verification",
    },

    kycSubmittedAt: {
      type: Date,
    },

    kycApprovedAt: {
      type: Date,
    },

    kycExpiryDate: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 1); // 1 year validity
        return date;
      },
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    reviewNote: {
      type: String,
      maxlength: 1000,
    },

    reviewHistory: [
      {
        status: {
          type: String,
          enum: ["under_review", "approved", "rejected"],
        },
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        note: String,
        reviewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Documents
    documents: [
      {
        documentType: {
          type: String,
          enum: [
            "national_id",        // National ID card
            "passport",           // International passport
            "business_certificate", // Certificate of incorporation
            "proof_of_address",   // Utility bill, bank statement
            "tax_clearance",      // Tax clearance certificate
            "bank_reference",     // Bank reference letter
            "trade_license",      // Trade license
            "quality_certificate", // ISO or other quality certs
            "other"
          ],
          required: true,
        },

        fileName: {
          type: String,
        },

        fileUrl: {
          type: String,
          required: true,
        },

        fileSize: {
          type: Number, // Size in bytes
        },

        mimeType: {
          type: String,
        },

        isVerified: {
          type: Boolean,
          default: false,
        },

        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        verifiedAt: {
          type: Date,
        },

        uploadedAt: {
          type: Date,
          default: Date.now,
        },

        notes: {
          type: String,
        },
      },
    ],

    // Bank Account Information
    bankDetails: {
      bankName: {
        type: String,
        default: "",
      },
      accountName: {
        type: String,
        default: "",
      },
      accountNumber: {
        type: String,
        default: "",
      },
      accountCurrency: {
        type: String,
        enum: ["NGN", "USD", "EUR", "GBP"],
        default: "NGN",
      },
      swiftCode: {
        type: String,
        default: "",
      },
      iban: {
        type: String,
        default: "",
      },
    },

    // Supplier Rating and Performance
    rating: {
      average: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
      },
      totalReviews: {
        type: Number,
        default: 0,
      },
      completedOrders: {
        type: Number,
        default: 0,
      },
      onTimeDelivery: {
        type: Number, // Percentage
        min: 0,
        max: 100,
        default: 0,
      },
    },

    // Status Flags
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
      comment: "Email/phone verified",
    },

    isBlacklisted: {
      type: Boolean,
      default: false,
    },

    blacklistReason: {
      type: String,
      default: "",
    },

    // Product Categories they supply
    productCategories: [
      {
        type: String,
        enum: [
          "gold_bars",
          "gold_jewelry",
          "gold_coins",
          "raw_gold",
          "other"
        ],
      },
    ],

    // Additional Metadata
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
supplierProfileSchema.index({ companyName: "text" }); // Text search
supplierProfileSchema.index({ country: 1, city: 1 });
supplierProfileSchema.index({ kycStatus: 1, isActive: 1 });
supplierProfileSchema.index({ "documents.documentType": 1 });

// Virtual field for display name
supplierProfileSchema.virtual("displayName").get(function() {
  return this.companyName || `${this.contactPerson.name || "Supplier"} (${this.user})`;
});

// Virtual for KYC completion percentage
supplierProfileSchema.virtual("kycCompletionPercentage").get(function() {
  let completed = 0;
  const total = 8; // Total required fields

  if (this.companyName && this.companyName !== "") completed++;
  if (this.registrationNumber && this.registrationNumber !== "") completed++;
  if (this.taxId && this.taxId !== "") completed++;
  if (this.country && this.country !== "") completed++;
  if (this.city && this.city !== "") completed++;
  if (this.address && this.address !== "") completed++;
  if (this.contactPerson.phone && this.contactPerson.phone !== "") completed++;
  if (this.bankDetails.accountNumber && this.bankDetails.accountNumber !== "") completed++;

  return Math.round((completed / total) * 100);
});

// Middleware to update timestamps
supplierProfileSchema.pre("save", function() {
  if (this.isModified("kycStatus") && this.kycStatus === "approved") {
    this.kycApprovedAt = new Date();
  }
  this.lastActivityAt = new Date();
});

// Static method to find pending KYC applications
supplierProfileSchema.statics.findPendingKYC = function() {
  return this.find({ 
    kycStatus: { $in: ["pending", "under_review"] },
    isActive: true 
  }).populate("user", "email name");
};

// Instance method to add document
supplierProfileSchema.methods.addDocument = async function(documentData) {
  this.documents.push(documentData);
  await this.save();
  return this;
};

// Instance method to update KYC status
supplierProfileSchema.methods.updateKYCStatus = async function(status, reviewerId, note) {
  const oldStatus = this.kycStatus;
  
  this.kycStatus = status;
  this.reviewedBy = reviewerId;
  
  if (note) this.reviewNote = note;
  
  // Add to review history
  this.reviewHistory.push({
    status: status,
    reviewedBy: reviewerId,
    note: note,
    reviewedAt: new Date()
  });
  
  if (status === "approved") {
    this.kycApprovedAt = new Date();
    this.kycLevel = 1; // Basic verification level
  }
  
  await this.save();
  
  return { oldStatus, newStatus: status };
};

// Export the model
module.exports = mongoose.model("SupplierProfile", supplierProfileSchema);
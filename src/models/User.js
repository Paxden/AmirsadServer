const mongoose = require("mongoose");

// KYC Schema (embedded for suppliers)
const kycSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      trim: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
    },
    taxId: {
      type: String,
      trim: true,
    },
    countryOfRegistration: {
      type: String,
      trim: true,
    },
    businessAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    documents: {
      certificateOfIncorporation: String, // Cloudinary/S3 URL
      taxClearanceCertificate: String,
      directorsIdentification: String,
      proofOfAddress: String,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "not_submitted"],
      default: "not_submitted",
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: Date,
    rejectionReason: String,
    notes: String,
  },
  { timestamps: true },
);

// Profile Schema (embedded for suppliers & buyers)
const profileSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    website: String,
    logo: String, // Cloudinary/S3 URL
    preferredContactMethod: {
      type: String,
      enum: ["email", "phone", "both"],
      default: "email",
    },
  },
  { _id: false },
);

// Account Settings Schema
const accountSettingsSchema = new mongoose.Schema(
  {
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: String,
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      default: "en",
    },
    timezone: {
      type: String,
      default: "UTC",
    },
  },
  { _id: false },
);

// Main User Schema
const userSchema = new mongoose.Schema(
  {
    // Basic Information
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: true, // Make required for OTP/notifications
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },

    // Role & Access Control
    role: {
      type: String,
      enum: ["admin", "staff", "supplier", "buyer"],
      default: "supplier",
      index: true,
    },

    // Account Status
    isVerified: {
      type: Boolean,
      default: false, // Email/phone verified
    },
    isActive: {
      type: Boolean,
      default: true, // Account not suspended
    },
    isApproved: {
      type: Boolean,
      default: false, // Staff/admin approval for suppliers/buyers
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    rejectionReason: String,

    // KYC & Verification (for suppliers)
    kyc: {
      type: kycSchema,
      default: () => ({}),
    },

    // Profile Information
    profile: {
      type: profileSchema,
      default: () => ({}),
    },

    // Account Settings
    settings: {
      type: accountSettingsSchema,
      default: () => ({}),
    },

    // Security & Tokens
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    refreshToken: String,
    lastLogin: Date,
    lastLoginIP: String,

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
    timestamps: true, // Adds createdAt & updatedAt
  },
);

// Indexes for better query performance
userSchema.index({ role: 1, isApproved: 1 });
userSchema.index({ "kyc.verificationStatus": 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ deletedAt: 1 });

// Virtual fields
userSchema.virtual("isAdmin").get(function () {
  return this.role === "admin";
});

userSchema.virtual("isStaff").get(function () {
  return this.role === "staff";
});

userSchema.virtual("isSupplier").get(function () {
  return this.role === "supplier";
});

userSchema.virtual("isBuyer").get(function () {
  return this.role === "buyer";
});

userSchema.virtual("canSubmitOpportunities").get(function () {
  return (
    this.role === "supplier" &&
    this.isApproved &&
    this.isActive &&
    this.kyc.verificationStatus === "approved"
  );
});

// Methods
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpires;
  delete user.refreshToken;
  delete user.twoFactorSecret;
  return user;
};

// Ensure virtuals are included in JSON output
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);

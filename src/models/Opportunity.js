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
        "refined", // Added refined
        "doré", // Added doré
        "scrap", // Added scrap
        "bars", // Added bars
        "nuggets", // Added nuggets
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
      enum: ["USD", "EUR", "GBP", "AED"],
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
      enum: ["draft", "pending", "under_review", "inspection", "approved", "rejected"],
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
  }
);

// Index for better query performance
opportunitySchema.index({ supplier: 1, status: 1 });
opportunitySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Opportunity", opportunitySchema);

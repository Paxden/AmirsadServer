const mongoose = require("mongoose");

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: String,
    category: {
      type: String,
      enum: ["general", "rfq", "appointment", "notification", "email", "security", "currencies"],
      default: "general",
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to add timestamps
systemSettingSchema.pre("save", function () {
  if (this.isModified("value")) {
    this.updatedAt = new Date();
  }
});

// Static method to get setting value
systemSettingSchema.statics.getValue = async function (key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to set setting value
systemSettingSchema.statics.setValue = async function (key, value, userId) {
  const setting = await this.findOneAndUpdate(
    { key },
    { value, lastModifiedBy: userId },
    { upsert: true, new: true }
  );
  return setting;
};

// Static method to get all settings by category
systemSettingSchema.statics.getByCategory = async function (category) {
  return this.find({ category }).sort("key");
};

module.exports = mongoose.model("SystemSetting", systemSettingSchema);

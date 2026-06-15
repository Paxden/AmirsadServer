/**
 * Validate KYC submission data
 */
exports.validateKYC = (req, res, next) => {
  const {
    businessName,
    registrationNumber,
    taxId,
    countryOfRegistration,
  } = req.body;

  const errors = [];

  if (!businessName || businessName.trim().length < 2) {
    errors.push("Business name is required and must be at least 2 characters");
  }

  if (!registrationNumber || registrationNumber.trim().length < 1) {
    errors.push("Registration number is required");
  }

  if (!taxId || taxId.trim().length < 1) {
    errors.push("Tax ID is required");
  }

  if (!countryOfRegistration) {
    errors.push("Country of registration is required");
  }

  // Check if documents are uploaded
  const requiredDocs = [
    "certificateOfIncorporation",
    "taxClearanceCertificate",
    "directorsIdentification",
    "proofOfAddress",
  ];

  const uploadedDocs = req.files || {};
  const missingDocs = requiredDocs.filter(doc => !uploadedDocs[doc]);

  if (missingDocs.length > 0) {
    errors.push(`Missing required documents: ${missingDocs.join(", ")}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "KYC validation failed",
      errors,
    });
  }

  next();
};
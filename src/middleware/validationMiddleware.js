const { body, validationResult } = require("express-validator");

exports.validateProfile = [
  body("companyName").notEmpty().withMessage("Company name is required"),
  body("country").notEmpty().withMessage("Country is required"),
  body("city").notEmpty().withMessage("City is required"),
  body("address").notEmpty().withMessage("Address is required"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];

exports.validateKYC = [
  body("status").isIn(["approved", "rejected"]).withMessage("Invalid status"),
  body("note").optional().isString().withMessage("Note must be a string"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  },
];
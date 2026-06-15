// utils/jwt.js (enhanced)
const jwt = require("jsonwebtoken");

const generateToken = (userId, role, expiresIn = "7d") => {
  return jwt.sign(
    {
      id: userId,
      role: role,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET,
    { expiresIn },
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: "refresh" },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
};

module.exports = { generateToken, generateRefreshToken };

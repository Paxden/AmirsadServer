const cloudinary = require("cloudinary").v2;

/**
 * Cloudinary Configuration
 * Media management and optimization service
 */
const configureCloudinary = () => {
  // Validate required environment variables
  const requiredConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };

  const missingKeys = Object.entries(requiredConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `❌ Missing Cloudinary configuration: ${missingKeys.join(", ")}. ` +
      `Please check your environment variables.`
    );
  }

  // Configure Cloudinary with explicit options
  cloudinary.config({
    cloud_name: requiredConfig.cloud_name,
    api_key: requiredConfig.api_key,
    api_secret: requiredConfig.api_secret,
    secure: true, // Always use HTTPS
  });

  console.log(`✅ Cloudinary configured successfully (Account: ${requiredConfig.cloud_name})`);
  
  return cloudinary;
};

// Initialize configuration
try {
  module.exports = configureCloudinary();
} catch (error) {
  console.error(error.message);
  
  // Export a fallback that throws meaningful errors when used
  module.exports = {
    uploader: {
      upload: async () => {
        throw new Error("Cloudinary is not configured properly. Check your environment variables.");
      },
    },
    url: () => {
      throw new Error("Cloudinary is not configured properly. Check your environment variables.");
    },
  };
}
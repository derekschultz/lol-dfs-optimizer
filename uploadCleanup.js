const fs = require("fs");
const path = require("path");

/**
 * Initializes a cleanup utility for the uploads directory
 * Deletes all files when the application is terminated
 * @param {string} uploadDir - The name of the uploads directory (default: 'uploads')
 * @returns {Object} An object with a cleanup method that can be called manually
 */
function initializeUploadCleanup(uploadDir = "uploads") {
  // Create uploads directory if it doesn't exist
  const uploadsPath = path.join(__dirname, uploadDir);
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  // Function to clean up uploads directory
  const cleanupUploads = () => {
    console.log("Cleaning up uploads directory...");

    try {
      // Check if directory exists
      if (fs.existsSync(uploadsPath)) {
        // Read all files in the directory
        const files = fs.readdirSync(uploadsPath);

        // Delete each file
        for (const file of files) {
          const filePath = path.join(uploadsPath, file);
          // Check if it's a file (not a directory)
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${file}`);
          }
        }

        console.log("Upload cleanup completed");
      }
    } catch (error) {
      console.error("Error during upload cleanup:", error);
    }
  };

  // Register cleanup handlers for various termination signals
  const cleanupAndExit = (signal) => {
    console.log(`Received ${signal}. Starting cleanup...`);
    cleanupUploads();
    console.log("Cleanup completed. Exiting...");
    process.exit(0);
  };

  // Register handlers for termination signals
  process.on("SIGINT", () => cleanupAndExit("SIGINT"));
  process.on("SIGTERM", () => cleanupAndExit("SIGTERM"));

  // Handle uncaught exceptions - cleanup before crashing
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    cleanupAndExit("uncaughtException");
  });

  // Provide a method to manually trigger cleanup
  return {
    cleanup: cleanupUploads,
  };
}

module.exports = initializeUploadCleanup;

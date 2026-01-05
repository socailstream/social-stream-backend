const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

try {
  // Path to your service account file
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

  // Check if file exists
  if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ serviceAccountKey.json not found in /config folder");
    module.exports = null;
    return;
  }

  // Load JSON file
  const serviceAccount = require(serviceAccountPath);

  // Initialize Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin initialized successfully using serviceAccountKey.json");

  module.exports = admin;

} catch (error) {
  console.error("❌ Firebase Admin initialization error:", error);
  console.error("   Check your serviceAccountKey.json formatting.");
  module.exports = null;
}

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  admin.initializeApp({
    credential: admin.credential.cert(
      path.resolve(serviceAccountPath)
    ),
  });
}

module.exports = admin;

import admin from 'firebase-admin';

export function initFirebase() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function verifyToken(token) {
  const decoded = await admin.auth().verifyIdToken(token);
  return { uid: decoded.uid, exp: decoded.exp };
}

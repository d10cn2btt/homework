import admin from '../config/firebase.js';

async function authenticateWS(req) {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  if (!token) throw new Error('NO_TOKEN');
  const decoded = await admin.auth().verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email, exp: decoded.exp };
}

export { authenticateWS };

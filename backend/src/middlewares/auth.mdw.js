import admin from '../config/firebase.js';
import prisma from '../config/db.js';

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Thiếu token xác thực' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
  } catch {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }

  // Check if user is INACTIVE in DB
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.uid },
      select: { status: true },
    });
    if (dbUser && dbUser.status === 'INACTIVE') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    }
  } catch {
    // If DB check fails (e.g. first-time user not yet in DB), proceed
  }

  next();
}

export default authMiddleware;

const prisma = require('../config/db');

async function getProfile(uid) {
  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: { userRole: { include: { role: true } } },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.userRole?.role?.name ?? null,
    status: user.status,
  };
}

async function updateProfile(uid, { displayName }) {
  if (!displayName?.trim()) {
    throw Object.assign(new Error('displayName is required'), { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: uid },
    data: { displayName: displayName.trim() },
  });

  return { id: user.id, email: user.email, displayName: user.displayName };
}

module.exports = { getProfile, updateProfile };

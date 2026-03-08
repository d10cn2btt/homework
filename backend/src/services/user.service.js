const prisma = require('../config/db');
const admin = require('../config/firebase');
const { invalidateRoleCache } = require('./role.service');

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    role: user.userRole?.role?.name ?? null,
    createdAt: user.createdAt,
  };
}

async function listUsers() {
  const users = await prisma.user.findMany({
    include: { userRole: { include: { role: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return users.map(formatUser);
}

async function getUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRole: { include: { role: true } } },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return formatUser(user);
}

async function createUser({ email, password, displayName }) {
  if (!email || !password) {
    throw Object.assign(new Error('email and password are required'), { status: 400 });
  }

  const firebaseUser = await admin.auth().createUser({ email, password, displayName });
  const role = await prisma.role.findUnique({ where: { name: 'USER' } });

  const user = await prisma.user.create({
    data: {
      id: firebaseUser.uid,
      email,
      displayName: displayName ?? null,
      userRole: { create: { roleId: role.id } },
    },
    include: { userRole: { include: { role: true } } },
  });

  return formatUser(user);
}

async function updateUser(id, { displayName, status }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(status !== undefined && { status }),
    },
    include: { userRole: { include: { role: true } } },
  });

  return formatUser(updated);
}

async function deleteUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRole: { include: { role: true } } },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // Block deleting the last ADMIN
  if (user.userRole?.role?.name === 'ADMIN') {
    const adminCount = await prisma.userRole.count({
      where: { role: { name: 'ADMIN' } },
    });
    if (adminCount <= 1) {
      throw Object.assign(new Error('Cannot delete the last admin'), { status: 400 });
    }
  }

  await admin.auth().deleteUser(id);
  await prisma.user.delete({ where: { id } }); // cascades user_roles + posts
}

async function updateUserRole(id, { role }) {
  if (!['ADMIN', 'USER'].includes(role)) {
    throw Object.assign(new Error('Invalid role'), { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // Block demoting the last ADMIN
  if (role === 'USER') {
    const current = await prisma.userRole.findUnique({
      where: { userId: id },
      include: { role: true },
    });
    if (current?.role?.name === 'ADMIN') {
      const adminCount = await prisma.userRole.count({
        where: { role: { name: 'ADMIN' } },
      });
      if (adminCount <= 1) {
        throw Object.assign(new Error('Cannot demote the last admin'), { status: 400 });
      }
    }
  }

  const roleRecord = await prisma.role.findUnique({ where: { name: role } });
  await prisma.userRole.update({
    where: { userId: id },
    data: { roleId: roleRecord.id },
  });

  await invalidateRoleCache(id);

  return { id, role };
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, updateUserRole };

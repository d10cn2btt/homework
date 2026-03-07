const prisma = require('../config/db');
const { delRoles } = require('./cache.service');
const { ConflictError, NotFoundError, ValidationError } = require('../utils/errors');

async function getUserRoles(uid) {
  const userRoles = await prisma.userRole.findMany({
    where: { user_id: uid },
    include: { role: true },
  });
  return userRoles.map((ur) => ur.role.name);
}

async function findOrCreateUser({ uid, email }) {
  let user = await prisma.user.findUnique({ where: { id: uid } });
  let created = false;

  if (!user) {
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    user = await prisma.user.create({
      data: {
        id: uid,
        email,
        display_name: email.split('@')[0],
        status: 'ACTIVE',
        user_roles: { create: { role_id: userRole.id } },
      },
    });
    created = true;
  }

  const roles = await getUserRoles(uid);
  return { user, roles, created };
}

async function getProfile(uid) {
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');
  const roles = await getUserRoles(uid);
  return { ...user, roles };
}

async function updateProfile(uid, { display_name }) {
  if (!display_name || display_name.trim().length === 0 || display_name.length > 100) {
    throw new ValidationError('Tên hiển thị phải từ 1 đến 100 ký tự');
  }
  const user = await prisma.user.update({
    where: { id: uid },
    data: { display_name: display_name.trim() },
  });
  return user;
}

async function listUsers({ page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;
  const [total, users] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const usersWithRoles = await Promise.all(
    users.map(async (u) => {
      const roles = await getUserRoles(u.id);
      return { ...u, roles };
    })
  );

  return { users: usersWithRoles, total, page, totalPages: Math.ceil(total / limit) };
}

async function createUser(adminSdk, { email, display_name, password }) {
  // Create in Firebase first
  let firebaseUser;
  try {
    firebaseUser = await adminSdk.auth().createUser({ email, password, displayName: display_name });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new ConflictError('Email đã tồn tại');
    }
    throw err;
  }

  // Check if already in DB (e.g. created via sync)
  const existing = await prisma.user.findUnique({ where: { id: firebaseUser.uid } });
  if (existing) {
    throw new ConflictError('Email đã tồn tại');
  }

  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  const user = await prisma.user.create({
    data: {
      id: firebaseUser.uid,
      email,
      display_name,
      status: 'ACTIVE',
      user_roles: { create: { role_id: userRole.id } },
    },
  });

  const roles = await getUserRoles(user.id);
  return { ...user, roles };
}

async function getUserById(uid) {
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');
  const roles = await getUserRoles(uid);
  return { ...user, roles };
}

async function countAdmins() {
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  return prisma.userRole.count({ where: { role_id: adminRole.id } });
}

async function updateUser(uid, { display_name, status }) {
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');

  if (status === 'INACTIVE') {
    const roles = await getUserRoles(uid);
    if (roles.includes('ADMIN')) {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        throw new ValidationError('Không thể vô hiệu hóa Admin cuối cùng');
      }
    }
  }

  const data = {};
  if (display_name !== undefined) {
    if (!display_name || display_name.trim().length === 0 || display_name.length > 100) {
      throw new ValidationError('Tên hiển thị phải từ 1 đến 100 ký tự');
    }
    data.display_name = display_name.trim();
  }
  if (status !== undefined) {
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      throw new ValidationError('Trạng thái phải là ACTIVE hoặc INACTIVE');
    }
    data.status = status;
  }

  const updated = await prisma.user.update({ where: { id: uid }, data });
  const roles = await getUserRoles(uid);
  return { ...updated, roles };
}

async function deleteUser(adminSdk, uid) {
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw new NotFoundError('Không tìm thấy người dùng');

  const roles = await getUserRoles(uid);
  if (roles.includes('ADMIN')) {
    const adminCount = await countAdmins();
    if (adminCount <= 1) {
      throw new ValidationError('Không thể xóa Admin cuối cùng');
    }
  }

  await prisma.$transaction([
    prisma.post.updateMany({ where: { author_id: uid }, data: { author_id: null } }),
    prisma.userRole.deleteMany({ where: { user_id: uid } }),
    prisma.user.delete({ where: { id: uid } }),
  ]);

  await delRoles(uid);

  try {
    await adminSdk.auth().deleteUser(uid);
  } catch {
    // Firebase user may not exist; DB deletion is the source of truth
  }
}

module.exports = {
  findOrCreateUser,
  getProfile,
  updateProfile,
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getUserRoles,
};

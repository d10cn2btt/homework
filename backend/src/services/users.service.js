import prisma from '../config/db.js';
import { delRoles } from './cache.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

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
    const resolvedEmail = email || `${uid}@github.users.noreply`;
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    user = await prisma.user.create({
      data: {
        id: uid,
        email: resolvedEmail,
        display_name: resolvedEmail.split('@')[0],
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
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);
  const skip = (page - 1) * limit;
  const [total, users] = await Promise.all([
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
  const resolvedDisplayName = display_name?.trim() || email.split('@')[0];

  // Create in Firebase first
  let firebaseUser;
  try {
    firebaseUser = await adminSdk.auth().createUser({
      email,
      password,
      displayName: resolvedDisplayName,
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new ConflictError('Email đã tồn tại');
    }
    throw err;
  }

  // Check if already in DB (e.g. created via sync)
  const existing = await prisma.user.findUnique({ where: { id: firebaseUser.uid } });
  if (existing) {
    await adminSdk.auth().deleteUser(firebaseUser.uid);
    throw new ConflictError('Email đã tồn tại');
  }

  try {
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    const user = await prisma.user.create({
      data: {
        id: firebaseUser.uid,
        email,
        display_name: resolvedDisplayName,
        status: 'ACTIVE',
        user_roles: { create: { role_id: userRole.id } },
      },
    });
    const roles = await getUserRoles(user.id);
    return { ...user, roles };
  } catch (err) {
    await adminSdk.auth().deleteUser(firebaseUser.uid);
    throw err;
  }
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

export { findOrCreateUser, getProfile, updateProfile, listUsers, createUser, getUserById, updateUser, deleteUser, getUserRoles };

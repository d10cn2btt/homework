import prisma from '../config/db.js';
import { delRoles } from './cache.service.js';
import { getUserRoles } from './users.service.js';
import logger from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';

async function countAdmins() {
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  return prisma.userRole.count({ where: { role_id: adminRole.id } });
}

async function assignRole(actorUid, targetUid, newRoleName) {
  if (!['ADMIN', 'USER'].includes(newRoleName)) {
    throw new ValidationError('role phải là ADMIN hoặc USER');
  }

  const oldRoles = await getUserRoles(targetUid);

  // Last-admin guard: cannot demote last admin
  if (newRoleName === 'USER' && oldRoles.includes('ADMIN')) {
    const adminCount = await countAdmins();
    if (adminCount <= 1) {
      throw new ValidationError('Không thể hạ cấp Admin cuối cùng');
    }
  }

  const newRole = await prisma.role.findUnique({ where: { name: newRoleName } });

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { user_id: targetUid } }),
    prisma.userRole.create({ data: { user_id: targetUid, role_id: newRole.id } }),
  ]);

  // Synchronous cache invalidation
  await delRoles(targetUid);

  logger.info({
    event: 'role_changed',
    actor_uid: actorUid,
    target_uid: targetUid,
    old_roles: oldRoles,
    new_role: newRoleName,
    timestamp: new Date().toISOString(),
  });

  const updatedRoles = await getUserRoles(targetUid);
  return { id: targetUid, roles: updatedRoles, updated_at: new Date() };
}

export { assignRole };

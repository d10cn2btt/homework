const redis = require('../config/redis');
const prisma = require('../config/db');

const CACHE_TTL = 60 * 60; // 1 hour
const cacheKey = (uid) => `user:roles:${uid}`;

async function getRoleFromCache(uid) {
  return redis.get(cacheKey(uid));
}

async function setRoleToCache(uid, roleName) {
  await redis.setex(cacheKey(uid), CACHE_TTL, roleName);
}

async function invalidateRoleCache(uid) {
  await redis.del(cacheKey(uid));
}

async function getRoleFromDB(uid) {
  const userRole = await prisma.userRole.findUnique({
    where: { userId: uid },
    include: { role: true },
  });
  return userRole?.role?.name ?? null;
}

async function getRole(uid) {
  const cached = await getRoleFromCache(uid);
  if (cached) return cached;

  const role = await getRoleFromDB(uid);
  if (role) await setRoleToCache(uid, role);
  return role;
}

module.exports = { getRole, invalidateRoleCache };

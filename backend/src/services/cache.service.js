import redis from '../config/redis.js';

const ROLES_TTL = 3600;

async function getRoles(uid) {
  const value = await redis.get(`user:roles:${uid}`);
  if (!value) return null;
  return JSON.parse(value);
}

async function setRoles(uid, roles) {
  await redis.set(
    `user:roles:${uid}`,
    JSON.stringify(roles),
    'EX',
    ROLES_TTL
  );
}

async function delRoles(uid) {
  await redis.del(`user:roles:${uid}`);
}

export { getRoles, setRoles, delRoles };

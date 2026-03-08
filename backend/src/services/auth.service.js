const prisma = require('../config/db');

async function syncUser({ uid, email, name }) {
  const role = await prisma.role.findUnique({ where: { name: 'USER' } });

  const user = await prisma.user.upsert({
    where: { id: uid },
    update: { email, displayName: name ?? null },
    create: {
      id: uid,
      email,
      displayName: name ?? null,
      userRole: {
        create: { roleId: role.id },
      },
    },
    include: { userRole: { include: { role: true } } },
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.userRole?.role?.name ?? 'USER',
    status: user.status,
  };
}

module.exports = { syncUser };

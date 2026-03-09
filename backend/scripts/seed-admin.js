import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdmin(uid) {
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) {
    console.error('ADMIN role not found. Run: npx prisma db seed first.');
    process.exit(1);
  }

  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });

  await prisma.userRole.upsert({
    where: { user_id_role_id: { user_id: uid, role_id: adminRole.id } },
    update: {},
    create: { user_id: uid, role_id: adminRole.id },
  });

  // Remove USER role if present
  await prisma.userRole.deleteMany({
    where: { user_id: uid, role_id: userRole.id },
  });

  console.log(`Admin role assigned to uid: ${uid}`);
}

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/seed-admin.js <firebase-uid>');
  process.exit(1);
}

seedAdmin(uid)
  .catch(console.error)
  .finally(() => prisma.$disconnect());

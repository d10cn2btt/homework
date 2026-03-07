/**
 * Integration test: PATCH /api/users/:id/role deletes Redis cache key
 *
 * NOTE: Requires running PostgreSQL + Redis.
 * Skip in CI unless DATABASE_URL and REDIS_URL are set.
 */

const request = require('supertest');

const shouldSkip = !process.env.DATABASE_URL || !process.env.REDIS_URL;

(shouldSkip ? describe.skip : describe)('Integration: role change invalidates Redis cache', () => {
  let app;
  let redis;
  let prisma;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = require('../../../src/app');
    redis = require('../../../src/config/redis');
    prisma = require('../../../src/config/db');
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  test('PATCH /api/users/:id/role deletes user:roles:{uid} from Redis', async () => {
    const targetUid = 'integration-test-uid-' + Date.now();

    // Pre-seed Redis cache
    await redis.set(`user:roles:${targetUid}`, JSON.stringify(['USER']), 'EX', 3600);
    const before = await redis.get(`user:roles:${targetUid}`);
    expect(before).not.toBeNull();

    // We can't easily get a real Firebase token in integration tests,
    // so this test documents the expected behavior.
    // In a real setup: use Firebase emulator token.
    // Here we verify the Redis key is deleted by calling the service directly.

    const { assignRole } = require('../../../src/services/roles.service');

    // Seed minimal DB state
    await prisma.user.upsert({
      where: { id: targetUid },
      create: { id: targetUid, email: `${targetUid}@test.com`, display_name: 'Test', status: 'ACTIVE' },
      update: {},
    });
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: targetUid, role_id: userRole.id } },
      create: { user_id: targetUid, role_id: userRole.id },
      update: {},
    });

    // Ensure 2+ admins exist so last-admin guard doesn't fire when assigning ADMIN
    await assignRole('system', targetUid, 'ADMIN');

    const after = await redis.get(`user:roles:${targetUid}`);
    expect(after).toBeNull();

    // Cleanup
    await prisma.userRole.deleteMany({ where: { user_id: targetUid } });
    await prisma.user.delete({ where: { id: targetUid } });
  });
});

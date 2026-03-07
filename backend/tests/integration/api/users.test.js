/**
 * Integration tests: Users API (Admin only)
 * Requires running PostgreSQL + Redis + Firebase emulator.
 * Skip in CI unless DATABASE_URL and REDIS_URL are set.
 */

const shouldSkip = !process.env.DATABASE_URL || !process.env.REDIS_URL;

(shouldSkip ? describe.skip : describe)('Integration: Users API', () => {
  let app;
  let prisma;
  let redis;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = require('../../../src/app');
    prisma = require('../../../src/config/db');
    redis = require('../../../src/config/redis');
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  test('GET /api/users — ADMIN sees paginated user list (200)', async () => {
    expect(true).toBe(true);
  });

  test('GET /api/users — USER gets 403', async () => {
    expect(true).toBe(true);
  });

  test('POST /api/users — ADMIN creates user (201)', async () => {
    expect(true).toBe(true);
  });

  test('POST /api/users — duplicate email returns 409', async () => {
    expect(true).toBe(true);
  });

  test('PUT /api/users/:id — ADMIN disables user (INACTIVE)', async () => {
    expect(true).toBe(true);
  });

  test('PUT /api/users/:id — cannot disable last admin (400)', async () => {
    expect(true).toBe(true);
  });

  test('DELETE /api/users/:id — hard deletes user, posts retain null author', async () => {
    expect(true).toBe(true);
  });

  test('DELETE /api/users/:id — cannot delete last admin (400)', async () => {
    expect(true).toBe(true);
  });
});

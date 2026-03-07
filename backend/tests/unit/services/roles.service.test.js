jest.mock('../../../src/config/db');
jest.mock('../../../src/config/redis');
jest.mock('../../../src/utils/logger', () => ({ info: jest.fn() }));

const prisma = require('../../../src/config/db');
const redis = require('../../../src/config/redis');
const logger = require('../../../src/utils/logger');

// Mock cache.service to use mocked redis
jest.mock('../../../src/services/cache.service', () => ({
  delRoles: jest.fn().mockResolvedValue(undefined),
  getRoles: jest.fn().mockResolvedValue(null),
  setRoles: jest.fn().mockResolvedValue(undefined),
}));

const { delRoles } = require('../../../src/services/cache.service');
const { assignRole } = require('../../../src/services/roles.service');

function setupPrismaMocks({ oldRoleName = 'USER', adminCount = 2 } = {}) {
  prisma.userRole = {
    findMany: jest.fn().mockResolvedValue([{ role: { name: oldRoleName } }]),
    deleteMany: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(adminCount),
  };
  prisma.role = {
    findUnique: jest.fn().mockImplementation(({ where: { name } }) =>
      Promise.resolve({ id: name === 'ADMIN' ? 1 : 2, name })
    ),
  };
  prisma.$transaction = jest.fn().mockImplementation((ops) => Promise.all(ops));
}

describe('roles.service — assignRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('assigns new role, invalidates Redis cache, logs security event', async () => {
    setupPrismaMocks({ oldRoleName: 'USER' });
    prisma.userRole.findMany
      .mockResolvedValueOnce([{ role: { name: 'USER' } }])  // old roles
      .mockResolvedValueOnce([{ role: { name: 'ADMIN' } }]); // updated roles

    await assignRole('actor123', 'target456', 'ADMIN');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(delRoles).toHaveBeenCalledWith('target456');
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'role_changed',
        actor_uid: 'actor123',
        target_uid: 'target456',
        new_role: 'ADMIN',
      })
    );
  });

  test('throws ValidationError when demoting last admin', async () => {
    setupPrismaMocks({ oldRoleName: 'ADMIN', adminCount: 1 });
    prisma.userRole.findMany.mockResolvedValue([{ role: { name: 'ADMIN' } }]);

    await expect(assignRole('actor123', 'target456', 'USER')).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(delRoles).not.toHaveBeenCalled();
  });

  test('allows demotion when there are multiple admins', async () => {
    setupPrismaMocks({ oldRoleName: 'ADMIN', adminCount: 2 });
    prisma.userRole.findMany
      .mockResolvedValueOnce([{ role: { name: 'ADMIN' } }])
      .mockResolvedValueOnce([{ role: { name: 'USER' } }]);

    const result = await assignRole('actor123', 'target456', 'USER');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(delRoles).toHaveBeenCalledWith('target456');
    expect(result.roles).toEqual(['USER']);
  });
});

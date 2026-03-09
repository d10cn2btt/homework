jest.mock('../../../src/config/db.js');
jest.mock('../../../src/services/cache.service.js');

import prisma from '../../../src/config/db.js';
import * as cacheService from '../../../src/services/cache.service.js';
import requireRole from '../../../src/middlewares/acl.mdw.js';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ACL middleware — requireRole()', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('cache-hit ADMIN passes through when ADMIN required', async () => {
    cacheService.getRoles.mockResolvedValue(['ADMIN']);
    const middleware = requireRole('ADMIN');
    const req = { user: { uid: 'uid1' } };
    const res = mockRes();

    await middleware(req, res, next);

    expect(req.user.roles).toEqual(['ADMIN']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('cache-hit USER without required ADMIN role returns 403', async () => {
    cacheService.getRoles.mockResolvedValue(['USER']);
    const middleware = requireRole('ADMIN');
    const req = { user: { uid: 'uid2' } };
    const res = mockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('cache-miss: queries DB, caches result, and passes through', async () => {
    cacheService.getRoles.mockResolvedValue(null);
    cacheService.setRoles.mockResolvedValue(undefined);
    prisma.userRole = {
      findMany: jest.fn().mockResolvedValue([{ role: { name: 'ADMIN' } }]),
    };

    const middleware = requireRole('ADMIN');
    const req = { user: { uid: 'uid3' } };
    const res = mockRes();

    await middleware(req, res, next);

    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'uid3' } })
    );
    expect(cacheService.setRoles).toHaveBeenCalledWith('uid3', ['ADMIN']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('cache-miss: DB returns no roles → 403', async () => {
    cacheService.getRoles.mockResolvedValue(null);
    cacheService.setRoles.mockResolvedValue(undefined);
    prisma.userRole = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    const middleware = requireRole('ADMIN');
    const req = { user: { uid: 'uid4' } };
    const res = mockRes();

    await middleware(req, res, next);

    expect(cacheService.setRoles).toHaveBeenCalledWith('uid4', []);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('no role required (requireRole()): any authenticated user passes', async () => {
    cacheService.getRoles.mockResolvedValue(['USER']);
    const middleware = requireRole();
    const req = { user: { uid: 'uid5' } };
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('missing req.user returns 401', async () => {
    const middleware = requireRole('ADMIN');
    const req = {};
    const res = mockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

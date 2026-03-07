jest.mock('../../../src/config/firebase');
jest.mock('../../../src/config/db');

const admin = require('../../../src/config/firebase');
const prisma = require('../../../src/config/db');
const authMiddleware = require('../../../src/middlewares/auth.mdw');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

describe('auth middleware', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
    prisma.user = { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('valid token sets req.user and calls next', async () => {
    admin.auth = jest.fn().mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid123', email: 'user@test.com' }),
    });

    const req = mockReq('Bearer validtoken');
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(req.user).toEqual({ uid: 'uid123', email: 'user@test.com' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('missing Authorization header returns 401', async () => {
    const req = mockReq(undefined);
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });

  test('Authorization header without Bearer prefix returns 401', async () => {
    const req = mockReq('Basic sometoken');
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('expired / invalid token returns 401', async () => {
    admin.auth = jest.fn().mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('Token expired')),
    });

    const req = mockReq('Bearer expiredtoken');
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('malformed token returns 401', async () => {
    admin.auth = jest.fn().mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('Decoding Firebase ID token failed')),
    });

    const req = mockReq('Bearer notavalidjwtatall');
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('INACTIVE user returns 403', async () => {
    admin.auth = jest.fn().mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid123', email: 'user@test.com' }),
    });
    prisma.user.findUnique = jest.fn().mockResolvedValue({ status: 'INACTIVE' });

    const req = mockReq('Bearer validtoken');
    const res = mockRes();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

const request = require('supertest');
const app = require('../../app');
const admin = require('../../config/firebase');
const prisma = require('../../config/db');

jest.mock('../../config/firebase', () => ({
  auth: jest.fn(),
}));

jest.mock('../../config/db', () => ({
  user: { findUnique: jest.fn() },
  room: { findUnique: jest.fn(), create: jest.fn() },
  roomMember: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  message: { findMany: jest.fn() },
}));

const mockVerifyToken = (uid = 'user1') => {
  admin.auth.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid, email: `${uid}@test.com` }),
  });
  prisma.user.findUnique.mockResolvedValue({ id: uid, status: 'ACTIVE' });
};

const authHeader = (token = 'valid-token') => ({ Authorization: `Bearer ${token}` });

describe('POST /api/chat/rooms', () => {
  test('valid name → 201, room created', async () => {
    mockVerifyToken('creator1');
    prisma.room.create.mockResolvedValue({ id: 'room1', name: 'My Room', created_by: 'creator1' });

    const res = await request(app)
      .post('/api/chat/rooms')
      .set(authHeader())
      .send({ name: 'My Room' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('My Room');
  });

  test('missing name → 400', async () => {
    mockVerifyToken('creator1');

    const res = await request(app)
      .post('/api/chat/rooms')
      .set(authHeader())
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/chat/rooms', () => {
  test('returns only rooms user is member of', async () => {
    mockVerifyToken('user1');
    prisma.roomMember.findMany.mockResolvedValue([
      { room: { id: 'room1', name: 'Room 1', messages: [] } },
    ]);

    const res = await request(app)
      .get('/api/chat/rooms')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('room1');
  });
});

describe('POST /api/chat/rooms/:id/members', () => {
  test('creator adds member → 200', async () => {
    mockVerifyToken('creator1');
    prisma.room.findUnique.mockResolvedValue({ id: 'room1', name: 'Room 1', created_by: 'creator1' });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'creator1', status: 'ACTIVE' }).mockResolvedValueOnce({ id: 'user2' });
    prisma.roomMember.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/chat/rooms/room1/members')
      .set(authHeader())
      .send({ userId: 'user2' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('non-creator adds member → 403', async () => {
    mockVerifyToken('other-user');
    prisma.room.findUnique.mockResolvedValue({ id: 'room1', name: 'Room 1', created_by: 'creator1' });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'other-user', status: 'ACTIVE' });

    const res = await request(app)
      .post('/api/chat/rooms/room1/members')
      .set(authHeader())
      .send({ userId: 'user2' });

    expect(res.status).toBe(403);
  });

  test('user already member → 409', async () => {
    mockVerifyToken('creator1');
    prisma.room.findUnique.mockResolvedValue({ id: 'room1', name: 'Room 1', created_by: 'creator1' });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'creator1', status: 'ACTIVE' }).mockResolvedValueOnce({ id: 'user2' });
    const uniqueError = new Error('Unique constraint failed');
    uniqueError.code = 'P2002';
    prisma.roomMember.create.mockRejectedValue(uniqueError);

    const res = await request(app)
      .post('/api/chat/rooms/room1/members')
      .set(authHeader())
      .send({ userId: 'user2' });

    expect(res.status).toBe(409);
  });
});

import { jest, beforeEach, describe, test, expect } from '@jest/globals';

const mockAdmin = { auth: jest.fn() };
const mockPrisma = {
  user: { findUnique: jest.fn() },
  room: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  roomMember: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  message: { findMany: jest.fn() },
};

jest.unstable_mockModule('../../config/firebase.js', () => ({ default: mockAdmin }));
jest.unstable_mockModule('../../config/db.js', () => ({ default: mockPrisma }));

const { default: request } = await import('supertest');
const { default: app } = await import('../../app.js');

const mockVerifyToken = (uid = 'user1') => {
  mockAdmin.auth.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid, email: `${uid}@test.com` }),
  });
  mockPrisma.user.findUnique.mockResolvedValue({ id: uid, status: 'ACTIVE' });
};

const authHeader = (token = 'valid-token') => ({ Authorization: `Bearer ${token}` });

beforeEach(() => jest.clearAllMocks());

describe('POST /api/chat/rooms', () => {
  test('valid name → 201, room created', async () => {
    mockVerifyToken('creator1');
    mockPrisma.room.create.mockResolvedValue({ id: 'room1', name: 'My Room', created_by: 'creator1' });

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
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room1', name: 'Room 1', created_by: 'other', members: [{ user_id: 'user1' }], messages: [] },
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
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room1', name: 'Room 1', created_by: 'creator1' });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'creator1', status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'user2' });
    mockPrisma.roomMember.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/chat/rooms/room1/members')
      .set(authHeader())
      .send({ userId: 'user2' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('non-creator adds member → 403', async () => {
    mockVerifyToken('other-user');
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room1', name: 'Room 1', created_by: 'creator1' });
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'other-user', status: 'ACTIVE' });

    const res = await request(app)
      .post('/api/chat/rooms/room1/members')
      .set(authHeader())
      .send({ userId: 'user2' });

    expect(res.status).toBe(403);
  });

  test('user already member → 409', async () => {
    mockVerifyToken('creator1');
    mockPrisma.room.findUnique.mockResolvedValue({ id: 'room1', name: 'Room 1', created_by: 'creator1' });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'creator1', status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'user2' });
    const uniqueError = new Error('Unique constraint failed');
    uniqueError.code = 'P2002';
    mockPrisma.roomMember.create.mockRejectedValue(uniqueError);

    const res = await request(app)
      .post('/api/chat/rooms/room1/members')
      .set(authHeader())
      .send({ userId: 'user2' });

    expect(res.status).toBe(409);
  });
});

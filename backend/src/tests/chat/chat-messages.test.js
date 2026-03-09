const request = require('supertest');
const app = require('../../app');
const admin = require('../../config/firebase');
const prisma = require('../../config/db');

jest.mock('../../config/firebase', () => ({
  auth: jest.fn(),
}));

jest.mock('../../config/db', () => ({
  user: { findUnique: jest.fn() },
  message: { findMany: jest.fn() },
}));

const mockVerifyToken = (uid = 'user1') => {
  admin.auth.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid, email: `${uid}@test.com` }),
  });
  prisma.user.findUnique.mockResolvedValue({ id: uid, status: 'ACTIVE' });
};

const authHeader = () => ({ Authorization: 'Bearer valid-token' });

function makeMessages(count, startIdx = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${startIdx + i}`,
    room_id: 'room1',
    sender_id: 'user1',
    content: `message ${startIdx + i}`,
    created_at: new Date(),
    sender: { display_name: 'User One' },
  }));
}

describe('GET /api/chat/rooms/:id/messages', () => {
  test('no before → returns up to 50 messages', async () => {
    mockVerifyToken();
    const msgs = makeMessages(50);
    prisma.message.findMany.mockResolvedValue(msgs);

    const res = await request(app)
      .get('/api/chat/rooms/room1/messages')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(50);
    expect(res.body.meta.nextCursor).toBe('msg-49');
  });

  test('limit=2 → returns 2 messages with nextCursor', async () => {
    mockVerifyToken();
    const msgs = makeMessages(2);
    prisma.message.findMany.mockResolvedValue(msgs);

    const res = await request(app)
      .get('/api/chat/rooms/room1/messages?limit=2')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.nextCursor).toBeTruthy();
  });

  test('before=<cursor> → returns messages before cursor, not including cursor', async () => {
    mockVerifyToken();
    const msgs = makeMessages(3, 10);
    prisma.message.findMany.mockResolvedValue(msgs);

    const res = await request(app)
      .get('/api/chat/rooms/room1/messages?before=msg-13')
      .set(authHeader());

    expect(res.status).toBe(200);
    const ids = res.body.data.map((m) => m.id);
    expect(ids).not.toContain('msg-13');
    const callArgs = prisma.message.findMany.mock.calls[0][0];
    expect(callArgs.where.id).toEqual({ lt: 'msg-13' });
  });
});

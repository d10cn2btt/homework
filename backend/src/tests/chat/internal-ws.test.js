import { jest, beforeEach, describe, test, expect } from '@jest/globals';

const mockAdmin = { auth: jest.fn() };
const mockPrisma = {
  message: { create: jest.fn(), update: jest.fn() },
  roomMember: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  room: { findUnique: jest.fn(), findMany: jest.fn() },
};
const mockRedis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
const mockGatewayClient = { deliver: jest.fn() };

jest.unstable_mockModule('../../config/firebase.js', () => ({ default: mockAdmin }));
jest.unstable_mockModule('../../config/db.js', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../../config/redis.js', () => ({ default: mockRedis }));
jest.unstable_mockModule('../../services/gateway-client.service.js', () => mockGatewayClient);

const { default: request } = await import('supertest');
const { default: app } = await import('../../app.js');
const { saveAndBroadcast } = await import('../../services/chat.service.js');

beforeEach(() => jest.clearAllMocks());

// ─── Route: POST /internal/ws/connect ────────────────────────────────────────

describe('POST /internal/ws/connect', () => {
  test('body hợp lệ → 200 + Redis key được ghi', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const res = await request(app)
      .post('/internal/ws/connect')
      .send({ userId: 'user1', connId: 'conn-abc', gatewayUrl: 'http://gateway:8080' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockRedis.set).toHaveBeenCalledWith(
      'ws:registry:user1',
      JSON.stringify([{ connId: 'conn-abc', gatewayUrl: 'http://gateway:8080' }]),
      'EX',
      7200,
    );
  });
});

// ─── Route: POST /internal/ws/disconnect ─────────────────────────────────────

describe('POST /internal/ws/disconnect', () => {
  test('Redis entry bị xóa sau khi disconnect', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify([{ connId: 'conn-abc', gatewayUrl: 'http://gateway:8080' }]),
    );
    mockRedis.del.mockResolvedValue(1);

    const res = await request(app)
      .post('/internal/ws/disconnect')
      .send({ userId: 'user1', connId: 'conn-abc' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockRedis.del).toHaveBeenCalledWith('ws:registry:user1');
  });
});

// ─── Route: POST /internal/ws/message ────────────────────────────────────────

describe('POST /internal/ws/message', () => {
  test('members có entries trong Redis → deliver() gọi cho từng member → { ok: true }', async () => {
    const savedMsg = {
      id: 'msg1',
      room_id: 'room1',
      sender_id: 'user1',
      type: 'USER',
      content: 'hello',
      created_at: new Date(),
      sender: { display_name: 'Alice' },
    };
    mockPrisma.message.create.mockResolvedValue(savedMsg);
    mockPrisma.message.update.mockResolvedValue({});
    mockPrisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user1' }, { user_id: 'user2' }]);

    mockRedis.get
      .mockResolvedValueOnce(
        JSON.stringify([{ connId: 'conn-u1', gatewayUrl: 'http://gw:8080' }]),
      )
      .mockResolvedValueOnce(
        JSON.stringify([{ connId: 'conn-u2', gatewayUrl: 'http://gw:8080' }]),
      );

    mockGatewayClient.deliver.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/internal/ws/message')
      .send({ from: 'user1', roomId: 'room1', content: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockGatewayClient.deliver).toHaveBeenCalledTimes(2);
  });

  test('tất cả members offline → message persist với status: SENT, deliveredCount: 0', async () => {
    const savedMsg = {
      id: 'msg2',
      room_id: 'room1',
      sender_id: 'user1',
      type: 'USER',
      content: 'hello',
      created_at: new Date(),
      sender: { display_name: 'Alice' },
    };
    mockPrisma.message.create.mockResolvedValue(savedMsg);
    mockPrisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user2' }, { user_id: 'user3' }]);
    mockRedis.get.mockResolvedValue(null);

    const res = await request(app)
      .post('/internal/ws/message')
      .send({ from: 'user1', roomId: 'room1', content: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { messageId: 'msg2', deliveredCount: 0 } });
    expect(mockPrisma.message.update).not.toHaveBeenCalled();
    expect(mockGatewayClient.deliver).not.toHaveBeenCalled();
  });
});

// ─── Service: saveAndBroadcast — multi-device ─────────────────────────────────

describe('saveAndBroadcast() — multi-device', () => {
  test('1 user có 2 connIds → deliver() gọi 2 lần', async () => {
    const savedMsg = {
      id: 'msg3',
      room_id: 'room1',
      sender_id: 'user1',
      type: 'USER',
      content: 'hi',
      created_at: new Date(),
      sender: { display_name: 'Alice' },
    };
    mockPrisma.message.create.mockResolvedValue(savedMsg);
    mockPrisma.message.update.mockResolvedValue({});
    mockPrisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user2' }]);

    mockRedis.get.mockResolvedValue(
      JSON.stringify([
        { connId: 'conn-tab1', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn-tab2', gatewayUrl: 'http://gw:8080' },
      ]),
    );
    mockGatewayClient.deliver.mockResolvedValue({ success: true });

    const result = await saveAndBroadcast('user1', 'room1', 'hi');

    expect(mockGatewayClient.deliver).toHaveBeenCalledTimes(2);
    expect(result.deliveredCount).toBe(2);
  });

  test('1 CONN_NOT_FOUND → entry đó deregister, entry kia deliver thành công', async () => {
    const savedMsg = {
      id: 'msg4',
      room_id: 'room1',
      sender_id: 'user1',
      type: 'USER',
      content: 'hi',
      created_at: new Date(),
      sender: { display_name: 'Alice' },
    };
    mockPrisma.message.create.mockResolvedValue(savedMsg);
    mockPrisma.message.update.mockResolvedValue({});
    mockPrisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user2' }]);

    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify([
        { connId: 'conn-stale', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn-live', gatewayUrl: 'http://gw:8080' },
      ]),
    );
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify([
        { connId: 'conn-stale', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn-live', gatewayUrl: 'http://gw:8080' },
      ]),
    );

    mockGatewayClient.deliver
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });

    const result = await saveAndBroadcast('user1', 'room1', 'hi');

    expect(mockGatewayClient.deliver).toHaveBeenCalledTimes(2);
    expect(result.deliveredCount).toBe(1);
  });
});

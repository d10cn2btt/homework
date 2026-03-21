// ─── Mocks (phải đứng trước tất cả import) ───────────────────────────────────

jest.mock('../../config/firebase.js', () => ({ auth: jest.fn() }));

jest.mock('../../config/db.js', () => ({
  message: { create: jest.fn(), update: jest.fn() },
  roomMember: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  room: { findUnique: jest.fn(), findMany: jest.fn() },
}));

jest.mock('../../config/redis.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../../services/gateway-client.service.js', () => ({
  deliver: jest.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import request from 'supertest';
import app from '../../app.js';
import redis from '../../config/redis.js';
import prisma from '../../config/db.js';
import { deliver } from '../../services/gateway-client.service.js';
import { saveAndBroadcast } from '../../services/chat.service.js';

beforeEach(() => jest.clearAllMocks());

// ─── Route: POST /internal/ws/connect ────────────────────────────────────────

describe('POST /internal/ws/connect', () => {
  test('body hợp lệ → 200 + Redis key được ghi', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');

    const res = await request(app)
      .post('/internal/ws/connect')
      .send({ userId: 'user1', connId: 'conn-abc', gatewayUrl: 'http://gateway:8080' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(redis.set).toHaveBeenCalledWith(
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
    redis.get.mockResolvedValue(
      JSON.stringify([{ connId: 'conn-abc', gatewayUrl: 'http://gateway:8080' }]),
    );
    redis.del.mockResolvedValue(1);

    const res = await request(app)
      .post('/internal/ws/disconnect')
      .send({ userId: 'user1', connId: 'conn-abc' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(redis.del).toHaveBeenCalledWith('ws:registry:user1');
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
    prisma.message.create.mockResolvedValue(savedMsg);
    prisma.message.update.mockResolvedValue({});
    prisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user1' }, { user_id: 'user2' }]);

    // user1: 1 connection, user2: 1 connection
    redis.get
      .mockResolvedValueOnce(
        JSON.stringify([{ connId: 'conn-u1', gatewayUrl: 'http://gw:8080' }]),
      )
      .mockResolvedValueOnce(
        JSON.stringify([{ connId: 'conn-u2', gatewayUrl: 'http://gw:8080' }]),
      );

    deliver.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/internal/ws/message')
      .send({ from: 'user1', roomId: 'room1', content: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(deliver).toHaveBeenCalledTimes(2);
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
    prisma.message.create.mockResolvedValue(savedMsg);
    prisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user2' }, { user_id: 'user3' }]);

    // Cả hai đều offline
    redis.get.mockResolvedValue(null);

    const res = await request(app)
      .post('/internal/ws/message')
      .send({ from: 'user1', roomId: 'room1', content: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { messageId: 'msg2', deliveredCount: 0 } });
    // message.update không được gọi vì deliveredCount = 0 (status giữ nguyên SENT)
    expect(prisma.message.update).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
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
    prisma.message.create.mockResolvedValue(savedMsg);
    prisma.message.update.mockResolvedValue({});
    prisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user2' }]);

    // user2 có 2 tabs mở
    redis.get.mockResolvedValue(
      JSON.stringify([
        { connId: 'conn-tab1', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn-tab2', gatewayUrl: 'http://gw:8080' },
      ]),
    );
    deliver.mockResolvedValue({ success: true });

    const result = await saveAndBroadcast('user1', 'room1', 'hi');

    expect(deliver).toHaveBeenCalledTimes(2);
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
    prisma.message.create.mockResolvedValue(savedMsg);
    prisma.message.update.mockResolvedValue({});
    prisma.roomMember.findMany.mockResolvedValue([{ user_id: 'user2' }]);

    // user2 có 2 connections
    redis.get.mockResolvedValueOnce(
      JSON.stringify([
        { connId: 'conn-stale', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn-live', gatewayUrl: 'http://gw:8080' },
      ]),
    );
    // deregister sẽ gọi redis.get lần thứ 2 để filter
    redis.get.mockResolvedValueOnce(
      JSON.stringify([
        { connId: 'conn-stale', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn-live', gatewayUrl: 'http://gw:8080' },
      ]),
    );

    // conn-stale trả về CONN_NOT_FOUND → deregister, conn-live thành công
    deliver
      .mockResolvedValueOnce({ success: false }) // stale → gateway-client tự deregister
      .mockResolvedValueOnce({ success: true }); // live → ok

    const result = await saveAndBroadcast('user1', 'room1', 'hi');

    expect(deliver).toHaveBeenCalledTimes(2);
    expect(result.deliveredCount).toBe(1);
  });
});

import { jest, beforeEach, describe, test, expect } from '@jest/globals';

const mockRedis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
jest.unstable_mockModule('../../config/redis.js', () => ({ default: mockRedis }));

const { register, deregister, lookup } = await import('../../services/ws-registry.service.js');

beforeEach(() => jest.clearAllMocks());

describe('register()', () => {
  test('thêm entry khi user chưa có connection', async () => {
    mockRedis.get.mockResolvedValue(null);

    await register('user1', 'conn1', 'http://gateway:8080');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'ws:registry:user1',
      JSON.stringify([{ connId: 'conn1', gatewayUrl: 'http://gateway:8080' }]),
      'EX',
      7200,
    );
  });

  test('append entry khi user đã có connection khác (multi-device)', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify([{ connId: 'conn1', gatewayUrl: 'http://gw:8080' }]),
    );

    await register('user1', 'conn2', 'http://gw:8080');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'ws:registry:user1',
      JSON.stringify([
        { connId: 'conn1', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn2', gatewayUrl: 'http://gw:8080' },
      ]),
      'EX',
      7200,
    );
  });
});

describe('lookup()', () => {
  test('trả đúng array khi key tồn tại', async () => {
    const entries = [
      { connId: 'conn1', gatewayUrl: 'http://gw:8080' },
      { connId: 'conn2', gatewayUrl: 'http://gw:8080' },
    ];
    mockRedis.get.mockResolvedValue(JSON.stringify(entries));

    const result = await lookup('user1');

    expect(result).toEqual(entries);
  });

  test('trả [] khi user offline (key không tồn tại)', async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await lookup('user1');

    expect(result).toEqual([]);
  });
});

describe('deregister()', () => {
  test('xóa đúng connId, giữ lại entry còn lại', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify([
        { connId: 'conn1', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn2', gatewayUrl: 'http://gw:8080' },
      ]),
    );

    await deregister('user1', 'conn1');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'ws:registry:user1',
      JSON.stringify([{ connId: 'conn2', gatewayUrl: 'http://gw:8080' }]),
      'EX',
      7200,
    );
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  test('DEL key khi xóa connId cuối cùng', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify([{ connId: 'conn1', gatewayUrl: 'http://gw:8080' }]),
    );

    await deregister('user1', 'conn1');

    expect(mockRedis.del).toHaveBeenCalledWith('ws:registry:user1');
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  test('no-op khi key không tồn tại', async () => {
    mockRedis.get.mockResolvedValue(null);

    await deregister('user1', 'conn1');

    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

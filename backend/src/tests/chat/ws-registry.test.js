jest.mock('../../config/redis.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

import redis from '../../config/redis.js';
import { register, deregister, lookup } from '../../services/ws-registry.service.js';

beforeEach(() => jest.clearAllMocks());

describe('register()', () => {
  test('thêm entry khi user chưa có connection', async () => {
    redis.get.mockResolvedValue(null);

    await register('user1', 'conn1', 'http://gateway:8080');

    expect(redis.set).toHaveBeenCalledWith(
      'ws:registry:user1',
      JSON.stringify([{ connId: 'conn1', gatewayUrl: 'http://gateway:8080' }]),
      'EX',
      7200,
    );
  });

  test('append entry khi user đã có connection khác (multi-device)', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify([{ connId: 'conn1', gatewayUrl: 'http://gw:8080' }]),
    );

    await register('user1', 'conn2', 'http://gw:8080');

    expect(redis.set).toHaveBeenCalledWith(
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
    redis.get.mockResolvedValue(JSON.stringify(entries));

    const result = await lookup('user1');

    expect(result).toEqual(entries);
  });

  test('trả [] khi user offline (key không tồn tại)', async () => {
    redis.get.mockResolvedValue(null);

    const result = await lookup('user1');

    expect(result).toEqual([]);
  });
});

describe('deregister()', () => {
  test('xóa đúng connId, giữ lại entry còn lại', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify([
        { connId: 'conn1', gatewayUrl: 'http://gw:8080' },
        { connId: 'conn2', gatewayUrl: 'http://gw:8080' },
      ]),
    );

    await deregister('user1', 'conn1');

    expect(redis.set).toHaveBeenCalledWith(
      'ws:registry:user1',
      JSON.stringify([{ connId: 'conn2', gatewayUrl: 'http://gw:8080' }]),
      'EX',
      7200,
    );
    expect(redis.del).not.toHaveBeenCalled();
  });

  test('DEL key khi xóa connId cuối cùng', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify([{ connId: 'conn1', gatewayUrl: 'http://gw:8080' }]),
    );

    await deregister('user1', 'conn1');

    expect(redis.del).toHaveBeenCalledWith('ws:registry:user1');
    expect(redis.set).not.toHaveBeenCalled();
  });

  test('no-op khi key không tồn tại', async () => {
    redis.get.mockResolvedValue(null);

    await deregister('user1', 'conn1');

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });
});

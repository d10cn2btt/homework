import { jest, beforeEach, describe, test, expect } from '@jest/globals';

const mockAxios = { post: jest.fn() };
const mockWsRegistry = { deregister: jest.fn() };

jest.unstable_mockModule('axios', () => ({ default: mockAxios }));
jest.unstable_mockModule('../../services/ws-registry.service.js', () => mockWsRegistry);

const { deliver } = await import('../../services/gateway-client.service.js');

beforeEach(() => jest.clearAllMocks());

describe('deliver()', () => {
  test('thành công ngay lần đầu', async () => {
    mockAxios.post.mockResolvedValue({ data: { success: true } });

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: true });
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(mockAxios.post).toHaveBeenCalledWith(
      'http://gw:8080/deliver',
      { connId: 'conn1', payload: { type: 'message' } },
      { timeout: 3000 },
    );
  });

  test('fail 2 lần rồi succeed → verify gọi đúng 3 lần', async () => {
    mockAxios.post
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ data: { success: true } });

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: true });
    expect(mockAxios.post).toHaveBeenCalledTimes(3);
  }, 5000);

  test('404 CONN_NOT_FOUND → deregister được gọi, không retry', async () => {
    const err = new Error('not found');
    err.response = { status: 404 };
    mockAxios.post.mockRejectedValue(err);

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: false });
    expect(mockWsRegistry.deregister).toHaveBeenCalledWith('user1', 'conn1');
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
  });

  test('hết retry vẫn lỗi → return { success: false }', async () => {
    mockAxios.post.mockRejectedValue(new Error('timeout'));

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: false });
    expect(mockAxios.post).toHaveBeenCalledTimes(3);
    expect(mockWsRegistry.deregister).not.toHaveBeenCalled();
  }, 5000);
});

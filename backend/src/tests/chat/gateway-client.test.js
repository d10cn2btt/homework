jest.mock('axios');
jest.mock('../../services/ws-registry.service.js', () => ({
  deregister: jest.fn(),
}));

import axios from 'axios';
import { deliver } from '../../services/gateway-client.service.js';
import * as wsRegistry from '../../services/ws-registry.service.js';

beforeEach(() => jest.clearAllMocks());

describe('deliver()', () => {
  test('thành công ngay lần đầu', async () => {
    axios.post.mockResolvedValue({ data: { success: true } });

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: true });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      'http://gw:8080/deliver',
      { connId: 'conn1', payload: { type: 'message' } },
      { timeout: 3000 },
    );
  });

  test('fail 2 lần rồi succeed → verify gọi đúng 3 lần', async () => {
    axios.post
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ data: { success: true } });

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: true });
    expect(axios.post).toHaveBeenCalledTimes(3);
  }, 5000);

  test('404 CONN_NOT_FOUND → deregister được gọi, không retry', async () => {
    const err = new Error('not found');
    err.response = { status: 404 };
    axios.post.mockRejectedValue(err);

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: false });
    expect(wsRegistry.deregister).toHaveBeenCalledWith('user1', 'conn1');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('hết retry vẫn lỗi → return { success: false }', async () => {
    axios.post.mockRejectedValue(new Error('timeout'));

    const result = await deliver('http://gw:8080', 'conn1', 'user1', { type: 'message' });

    expect(result).toEqual({ success: false });
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(wsRegistry.deregister).not.toHaveBeenCalled();
  }, 5000);
});

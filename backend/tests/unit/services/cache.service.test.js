jest.mock('../../../src/config/redis.js');

import redis from '../../../src/config/redis.js';
import { getRoles, setRoles, delRoles } from '../../../src/services/cache.service.js';

describe('cache.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getRoles returns parsed JSON array when key exists', async () => {
    redis.get = jest.fn().mockResolvedValue(JSON.stringify(['ADMIN']));

    const result = await getRoles('uid123');

    expect(redis.get).toHaveBeenCalledWith('user:roles:uid123');
    expect(result).toEqual(['ADMIN']);
  });

  test('getRoles returns null when key does not exist', async () => {
    redis.get = jest.fn().mockResolvedValue(null);

    const result = await getRoles('uid-missing');

    expect(result).toBeNull();
  });

  test('setRoles stores JSON array with EX 3600', async () => {
    redis.set = jest.fn().mockResolvedValue('OK');

    await setRoles('uid123', ['USER']);

    expect(redis.set).toHaveBeenCalledWith(
      'user:roles:uid123',
      JSON.stringify(['USER']),
      'EX',
      3600
    );
  });

  test('delRoles removes the key', async () => {
    redis.del = jest.fn().mockResolvedValue(1);

    await delRoles('uid123');

    expect(redis.del).toHaveBeenCalledWith('user:roles:uid123');
  });
});

// ws-registry.service.js
// Quản lý registry WebSocket connections trong Redis.
// Mỗi user có thể có nhiều connections (multi-tab, multi-device).
// Redis key: ws:registry:{userId} → JSON array of { connId, gatewayUrl }
// connId: ID duy nhất của 1 WS connection, do Gateway sinh ra (uuid)
// gatewayUrl: địa chỉ HTTP của Gateway đang giữ connection đó (dùng để gọi /deliver)

import redis from '../config/redis.js';

const KEY = (userId) => `ws:registry:${userId}`;
const TTL = 7200; // 2 giờ — tự expire nếu disconnect không gọi deregister

// Thêm 1 connection mới cho user.
// Gọi khi Gateway nhận WS connect và POST /internal/ws/connect.
export async function register(userId, connId, gatewayUrl) {
  const raw = await redis.get(KEY(userId));
  const entries = raw ? JSON.parse(raw) : [];
  entries.push({ connId, gatewayUrl });
  await redis.set(KEY(userId), JSON.stringify(entries), 'EX', TTL);
}

// Xóa 1 connection cụ thể của user theo connId.
// Gọi khi Gateway nhận WS close và POST /internal/ws/disconnect,
// hoặc khi /deliver nhận CONN_NOT_FOUND từ Gateway.
export async function deregister(userId, connId) {
  const raw = await redis.get(KEY(userId));
  if (!raw) return;

  const entries = JSON.parse(raw).filter((e) => e.connId !== connId);

  if (entries.length > 0) {
    // User vẫn còn connection khác (tab khác) → update lại array
    await redis.set(KEY(userId), JSON.stringify(entries), 'EX', TTL);
  } else {
    // Không còn connection nào → xóa key luôn
    await redis.del(KEY(userId));
  }
}

// Lấy tất cả connections đang active của user.
// Return [] nếu user offline (không có key trong Redis).
// Dùng trong saveAndBroadcast() để biết cần deliver tới đâu.
export async function lookup(userId) {
  const raw = await redis.get(KEY(userId));
  return raw ? JSON.parse(raw) : [];
}

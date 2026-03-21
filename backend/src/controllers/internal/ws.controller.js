// ws.controller.js (internal)
// Xử lý các HTTP request từ Gateway — không expose ra ngoài, chỉ dùng nội bộ.
// Nginx đã block /internal từ client bên ngoài.

import * as wsRegistry from '../../services/ws-registry.service.js';
import { saveAndBroadcast } from '../../services/chat.service.js';

// Gọi khi user connect WS thành công trên Gateway.
// Gateway gửi lên để Instance ghi vào Redis registry.
export async function handleConnect(req, res, next) {
  try {
    const { userId, connId, gatewayUrl } = req.body;
    await wsRegistry.register(userId, connId, gatewayUrl);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Gọi khi user gửi message qua WS.
// Instance lưu DB và broadcast tới tất cả members đang online trong room.
export async function handleMessage(req, res, next) {
  try {
    const { from, roomId, content } = req.body;
    const result = await saveAndBroadcast(from, roomId, content);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Gọi khi user đóng WS connection.
// Instance xóa entry khỏi Redis registry.
export async function handleDisconnect(req, res, next) {
  try {
    const { userId, connId } = req.body;
    await wsRegistry.deregister(userId, connId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

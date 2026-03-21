// gateway-client.service.js
// HTTP client để Instance gọi POST /deliver lên Gateway.
// Gateway sẽ tìm connId trong RAM và push payload xuống WS client.
// Có retry logic vì Gateway có thể tạm thời bận (deploy, restart).

import axios from 'axios';
import { deregister } from './ws-registry.service.js';
import logger from '../utils/logger.js';

// Retry delays (ms): lần 1 → 100ms, lần 2 → 300ms, lần 3 → 1s
const DELAYS = [100, 300, 1000];

// Gửi payload tới 1 WS connection cụ thể qua Gateway.
// - gatewayUrl: địa chỉ HTTP của Gateway (lấy từ Redis entry)
// - connId: ID của WS connection (lấy từ Redis entry)
// - userId: cần để deregister nếu Gateway báo CONN_NOT_FOUND
// - payload: object sẽ được JSON.stringify và ws.send() tới browser
export async function deliver(gatewayUrl, connId, userId, payload) {
  for (let i = 0; i < DELAYS.length; i++) {
    try {
      await axios.post(`${gatewayUrl}/deliver`, { connId, payload }, { timeout: 3000 });
      return { success: true };
    } catch (err) {
      if (err.response?.status === 404) {
        // Gateway không tìm thấy connId → connection đã đóng nhưng Redis chưa kịp xóa
        // Xóa stale entry khỏi Redis để lần sau không deliver nhầm
        await deregister(userId, connId);
        return { success: false };
      }
      // Lỗi mạng hoặc gateway tạm thời lỗi → chờ rồi retry
      if (i < DELAYS.length - 1) {
        await new Promise((res) => setTimeout(res, DELAYS[i]));
      }
    }
  }
  // Hết retry mà vẫn lỗi → log cảnh báo, không throw (không muốn crash cả broadcast)
  logger.warn({ connId }, '[gateway-client] deliver failed after retries');
  return { success: false };
}

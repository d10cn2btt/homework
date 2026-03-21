// ws-protocol.js
// Single source of truth cho toàn bộ WS protocol.
// Import file này ở Gateway. Frontend tham khảo để biết cần handle những gì.

// ─── Close Codes ─────────────────────────────────────────────────────────────
// Dùng khi ws.close(code) — connection bị đóng, không tiếp tục được.

export const WS_CLOSE = {
  NORMAL: 1000,         // User logout / đóng tab bình thường — client chủ động gọi ws.close()
  GOING_AWAY: 1001,     // Gateway graceful shutdown (deploy) — FE reconnect với exponential backoff
  TOKEN_INVALID: 4001,  // Token sai / không có token khi handshake — FE redirect login, không reconnect
  TOKEN_EXPIRED: 4002,  // Token sắp hết hạn — FE refresh Firebase token rồi reconnect
  DUPLICATE_CONN: 4003, // Tab/device khác connect cùng userId — tab cũ bị replace, không reconnect
};

// ─── Error Codes ─────────────────────────────────────────────────────────────
// Dùng trong payload { type: 'error', code: ... } — connection vẫn sống, chỉ báo lỗi mid-session.

export const WS_ERROR = {
  DELIVER_FAILED: 'DELIVER_FAILED',   // Message đã lưu DB nhưng recipient offline — sẽ deliver khi online
  INVALID_PAYLOAD: 'INVALID_PAYLOAD', // Payload thiếu field bắt buộc (roomId, content)
  INTERNAL_ERROR: 'INTERNAL_ERROR',   // Gateway không reach được Instance (Nginx/Instance down)
};

// ─── Payload Builders ────────────────────────────────────────────────────────
// Tránh typo khi tạo error object, đảm bảo format nhất quán.

export const wsError = (code, extra = {}) => ({
  type: 'error',
  code,
  ...extra,
});

// ─── Message Types ────────────────────────────────────────────────────────────
// Các type hợp lệ trong frame gửi từ client lên Gateway.

export const WS_CLIENT_TYPE = {
  PING: 'ping',       // Keepalive — Gateway trả pong, không forward lên Instance
  MESSAGE: 'message', // Gửi tin nhắn vào room
};

// Các type hợp lệ trong frame Gateway/Instance push xuống client.
export const WS_SERVER_TYPE = {
  PONG: 'pong',       // Response cho ping
  MESSAGE: 'message', // Tin nhắn mới trong room
  SYSTEM: 'system',   // Sự kiện hệ thống (join/leave room)
  ERROR: 'error',     // Lỗi mid-session — xem WS_ERROR để biết các code
};

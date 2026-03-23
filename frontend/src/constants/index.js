// frontend/src/constants/index.js
// Single source of truth cho tất cả string/number constants trong frontend.
// Sync thủ công với:
//   - gateway/ws-protocol.js  (WS_CLOSE, WS_ERROR, WS_CLIENT_TYPE, WS_SERVER_TYPE)
//   - backend/src/constants/index.js  (API_ERR)

// ─── WS Close Codes (mirror gateway/ws-protocol.js) ──────────────────────────
// Dùng trong ws-manager.js → ws.onclose(event) để phân loại lý do đóng connection.
// Browser standard: 1000-2999. App custom: 4000-4999 (Gateway tự định nghĩa).
export const WS_CLOSE = {
  NORMAL:         1000, // đóng bình thường (ít dùng — browser tự gửi khi tab đóng)
  GOING_AWAY:     1001, // Gateway restart → trigger exponential backoff reconnect
  TOKEN_INVALID:  4001, // token sai/expired khi connect → không reconnect, để auth xử lý
  TOKEN_EXPIRED:  4002, // token hết hạn trong session → force refresh rồi reconnect ngay
  DUPLICATE_CONN: 4003, // tab/device mới login → tab cũ bị đá ra, không reconnect
};

// ─── WS Error Codes (mirror gateway/ws-protocol.js) ──────────────────────────
// Dùng trong ws-manager.js → ws.onmessage khi frame.type === 'error'.
// Gateway gửi error frame thay vì đóng connection khi có lỗi xử lý message.
// ChatPage map code này sang human-readable string để hiện toast.
export const WS_ERROR = {
  CONN_NOT_FOUND:  'CONN_NOT_FOUND',  // deliver.route.js → connId không còn trong RAM Gateway
  DELIVER_FAILED:  'DELIVER_FAILED',  // gateway-client.service.js → hết retry mà vẫn fail
  INVALID_PAYLOAD: 'INVALID_PAYLOAD', // ws-handler.js → message từ client thiếu field
  INTERNAL_ERROR:  'INTERNAL_ERROR',  // ws-handler.js → lỗi không xác định khi xử lý message
};

// ─── WS Frame Types (mirror gateway/ws-protocol.js) ──────────────────────────
// WS_CLIENT_TYPE: frame do browser gửi lên Gateway.
// WS_SERVER_TYPE: frame do Gateway/Instance gửi xuống browser.
export const WS_CLIENT_TYPE = {
  PING:    'ping',    // gửi mỗi 30s để giữ connection sống, Gateway trả pong
  MESSAGE: 'message', // gửi chat message, Gateway forward lên Instance
};

export const WS_SERVER_TYPE = {
  PONG:    'pong',    // trả lời ping, ws-manager bỏ qua (không cần xử lý)
  MESSAGE: 'message', // chat message mới từ bất kỳ member nào trong room
  SYSTEM:  'system',  // thông báo hệ thống (member join/leave room...)
  ERROR:   'error',   // lỗi xử lý phía server, kèm WS_ERROR code
};

// ─── WS Connection Status ─────────────────────────────────────────────────────
// Internal state của WsManager, expose ra ngoài qua wsManager.getStatus() và event 'status'.
// ChatPage dùng để disable MessageInput khi chưa OPEN.
export const WS_STATUS = {
  CONNECTING: 'connecting', // default — đang chờ getIdToken() + WS handshake
  OPEN:       'open',       // kết nối thành công, có thể gửi message
  CLOSED:     'closed',     // mất kết nối, đang chờ reconnect
  AUTH_ERROR: 'auth_error', // token invalid/refresh fail — không reconnect, cần login lại
};

// ─── API Error Codes (mirror backend/src/constants/index.js) ─────────────────
// Dùng trong ChatPage để map lỗi từ REST API sang human-readable string cho toast.
export const API_ERR = {
  ROOM_NOT_FOUND:       'ROOM_NOT_FOUND',       // GET/POST /rooms/:id — room không tồn tại
  ALREADY_MEMBER:       'ALREADY_MEMBER',       // POST /rooms/:id/join — đã là member
  NOT_MEMBER:           'NOT_MEMBER',           // DELETE /rooms/:id/leave — chưa join
  CREATOR_CANNOT_LEAVE: 'CREATOR_CANNOT_LEAVE', // DELETE /rooms/:id/leave — owner không thể rời
  USER_NOT_FOUND:       'USER_NOT_FOUND',       // các endpoint liên quan user
  FORBIDDEN:            'FORBIDDEN',            // không đủ quyền (role check)
  VALIDATION_ERROR:     'VALIDATION_ERROR',     // request body thiếu/sai field
};

// backend/src/constants/index.js
// Single source of truth cho tất cả string constants trong backend.

// ─── Business Error Codes ─────────────────────────────────────────────────────
// Các code này được set làm message trong AppError (NotFoundError, ForbiddenError, ConflictError)
// và trả về trong HTTP response body. Frontend map code → display message.

export const ERR = {
  // Room
  ROOM_NOT_FOUND:       'ROOM_NOT_FOUND',
  ALREADY_MEMBER:       'ALREADY_MEMBER',
  NOT_MEMBER:           'NOT_MEMBER',
  CREATOR_CANNOT_LEAVE: 'CREATOR_CANNOT_LEAVE',
  // User
  USER_NOT_FOUND:       'USER_NOT_FOUND',
  // Generic
  FORBIDDEN:            'FORBIDDEN',
};

// ─── WS Delivery Frame Types ──────────────────────────────────────────────────
// Dùng khi Instance construct payload để deliver qua Gateway → browser.
// Phải khớp với WS_SERVER_TYPE trong gateway/ws-protocol.js.

export const WS_FRAME = {
  MESSAGE: 'message',
  SYSTEM:  'system',
};

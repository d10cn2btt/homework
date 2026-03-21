// frontend/src/constants/index.js
// Single source of truth cho tất cả string/number constants trong frontend.
// Sync thủ công với:
//   - gateway/ws-protocol.js  (WS_CLOSE, WS_ERROR, WS_CLIENT_TYPE, WS_SERVER_TYPE)
//   - backend/src/constants/index.js  (API_ERR)

// ─── WS Close Codes (mirror gateway/ws-protocol.js) ──────────────────────────
export const WS_CLOSE = {
  NORMAL:        1000,
  GOING_AWAY:    1001,
  TOKEN_INVALID: 4001,
  TOKEN_EXPIRED: 4002,
  DUPLICATE_CONN: 4003,
};

// ─── WS Error Codes (mirror gateway/ws-protocol.js) ──────────────────────────
export const WS_ERROR = {
  CONN_NOT_FOUND:  'CONN_NOT_FOUND',
  DELIVER_FAILED:  'DELIVER_FAILED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INTERNAL_ERROR:  'INTERNAL_ERROR',
};

// ─── WS Frame Types (mirror gateway/ws-protocol.js) ──────────────────────────
export const WS_CLIENT_TYPE = {
  PING:    'ping',
  MESSAGE: 'message',
};

export const WS_SERVER_TYPE = {
  PONG:    'pong',
  MESSAGE: 'message',
  SYSTEM:  'system',
  ERROR:   'error',
};

// ─── WS Connection Status ─────────────────────────────────────────────────────
export const WS_STATUS = {
  CONNECTING: 'connecting',
  OPEN:       'open',
  CLOSED:     'closed',
  AUTH_ERROR: 'auth_error',
};

// ─── API Error Codes (mirror backend/src/constants/index.js) ─────────────────
export const API_ERR = {
  ROOM_NOT_FOUND:       'ROOM_NOT_FOUND',
  ALREADY_MEMBER:       'ALREADY_MEMBER',
  NOT_MEMBER:           'NOT_MEMBER',
  CREATOR_CANNOT_LEAVE: 'CREATOR_CANNOT_LEAVE',
  USER_NOT_FOUND:       'USER_NOT_FOUND',
  FORBIDDEN:            'FORBIDDEN',
  VALIDATION_ERROR:     'VALIDATION_ERROR',
};

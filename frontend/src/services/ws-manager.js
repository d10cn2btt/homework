// ws-manager.js
// Singleton WebSocket manager — chỉ tạo 1 WS connection duy nhất cho toàn app.
// Hook useWebSocket() subscribe vào đây để nhận events, không tự quản lý WS nữa.
//
// Lifecycle:
//   connect()    — gọi khi hook mount, no-op nếu đã có connection
//   disconnect() — gọi khi user logout
//   send()       — gửi message qua WS hiện tại
//   on()         — subscribe nhận events (message, status, reconnected, wsError)

import { auth } from '../config/firebase.js';
import { WS_CLOSE, WS_CLIENT_TYPE, WS_SERVER_TYPE, WS_STATUS } from '../constants/index.js';

function getBackoffDelay(retryCount) {
  return Math.min(1000 * 2 ** retryCount, 30_000);
}

class WsManager {
  constructor() {
    this._ws = null;
    this._connecting = false; // guard tránh gọi connect() concurrent trong lúc await getIdToken
    this._intentionalClose = false;
    this._retryCount = 0;
    this._disconnectedAt = null;
    this._status = WS_STATUS.CONNECTING;
    this._listeners = {}; // { [event]: Set<callback> }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  // Gọi khi hook mount. No-op nếu đã có WS hoặc đang kết nối.
  async connect() {
    if (this._ws || this._connecting) return;
    this._connecting = true;
    this._intentionalClose = false;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { this._connecting = false; return; }

      // Có thể disconnect() được gọi trong lúc await getIdToken() → dừng
      if (this._intentionalClose) { this._connecting = false; return; }

      const wsBase =
        import.meta.env.VITE_GATEWAY_URL ??
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

      const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
      this._ws = ws;
      this._connecting = false;

      ws.onopen = () => {
        this._retryCount = 0;
        this._setStatus(WS_STATUS.OPEN);

        if (this._disconnectedAt !== null) {
          this._emit('reconnected', this._disconnectedAt);
          this._disconnectedAt = null;
        }

        ws._pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: WS_CLIENT_TYPE.PING }));
          }
        }, 30_000);
      };

      ws.onclose = (event) => {
        clearInterval(ws._pingInterval);
        this._ws = null;
        this._setStatus(WS_STATUS.CLOSED);

        if (event.code === WS_CLOSE.TOKEN_INVALID) {
          this._setStatus(WS_STATUS.AUTH_ERROR);
          return;
        }

        if (event.code === WS_CLOSE.DUPLICATE_CONN) return;
        if (this._intentionalClose) return;

        if (this._disconnectedAt === null) {
          this._disconnectedAt = new Date().toISOString();
        }

        if (event.code === WS_CLOSE.TOKEN_EXPIRED) {
          auth.currentUser
            ?.getIdToken(true)
            .then(() => this.connect())
            .catch(() => this._setStatus(WS_STATUS.AUTH_ERROR));
          return;
        }

        const delay = getBackoffDelay(this._retryCount);
        this._retryCount += 1;
        setTimeout(() => this.connect(), delay);
      };

      ws.onerror = () => this._setStatus(WS_STATUS.CLOSED);

      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === WS_SERVER_TYPE.MESSAGE || frame.type === WS_SERVER_TYPE.SYSTEM) {
            this._emit('message', frame);
          } else if (frame.type === WS_SERVER_TYPE.ERROR) {
            this._emit('wsError', {
              code: frame.code,
              messageId: frame.messageId ?? null,
              reason: frame.reason ?? null,
            });
          }
        } catch {
          // ignore parse errors
        }
      };
    } catch {
      this._connecting = false;
      if (!this._intentionalClose) {
        const delay = getBackoffDelay(this._retryCount);
        this._retryCount += 1;
        setTimeout(() => this.connect(), delay);
      }
    }
  }

  // Gọi khi user logout — đóng WS và reset state.
  disconnect() {
    this._intentionalClose = true;
    this._ws?.close();
    this._ws = null;
    this._retryCount = 0;
    this._disconnectedAt = null;
    this._setStatus(WS_STATUS.CLOSED);
  }

  send(roomId, content) {
    this._ws?.send(JSON.stringify({ type: WS_CLIENT_TYPE.MESSAGE, roomId, content }));
  }

  getStatus() {
    return this._status;
  }

  // Subscribe nhận event. Trả về hàm unsubscribe.
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = new Set();
    this._listeners[event].add(callback);
    return () => this._listeners[event]?.delete(callback);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _emit(event, data) {
    this._listeners[event]?.forEach((cb) => cb(data));
  }

  _setStatus(status) {
    this._status = status;
    this._emit('status', status);
  }
}

export const wsManager = new WsManager();

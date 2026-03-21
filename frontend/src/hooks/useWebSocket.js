import { useEffect, useRef, useState, useCallback } from 'react';
import { auth } from '../config/firebase';
import { WS_CLOSE, WS_CLIENT_TYPE, WS_SERVER_TYPE, WS_STATUS } from '../constants/index.js';

// Exponential backoff delays (ms): 1s, 2s, 4s, 8s, 16s, 30s (capped)
function getBackoffDelay(retryCount) {
  return Math.min(1000 * 2 ** retryCount, 30_000);
}

export function useWebSocket() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(WS_STATUS.CONNECTING);
  const [lastWsError, setLastWsError] = useState(null);
  // Timestamp cập nhật mỗi khi WS reconnect thành công sau disconnect
  // ChatPage watch giá trị này để fetch missed messages
  const [reconnectedAt, setReconnectedAt] = useState(null);

  const wsRef = useRef(null);
  const intentionalClose = useRef(false);
  const retryCount = useRef(0);
  // Thời điểm connection bị drop — dùng làm `since` param khi fetch missed messages
  const disconnectedAt = useRef(null);

  const connect = useCallback(async () => {
    try {
      // force: true để lấy token mới nhất từ Firebase (dùng khi 4002 token expired)
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const wsBase =
        import.meta.env.VITE_GATEWAY_URL ??
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCount.current = 0;
        setStatus(WS_STATUS.OPEN);

        // Nếu đây là reconnect (đã từng disconnect trước đó) → báo ChatPage fetch missed
        if (disconnectedAt.current !== null) {
          setReconnectedAt(disconnectedAt.current);
          disconnectedAt.current = null;
        }

        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: WS_CLIENT_TYPE.PING }));
          }
        }, 30_000);
        ws.pingInterval = pingInterval;
      };

      ws.onclose = (event) => {
        clearInterval(ws.pingInterval);
        setStatus(WS_STATUS.CLOSED);

        if (event.code === WS_CLOSE.TOKEN_INVALID) {
          // Token invalid — không reconnect, để auth flow xử lý
          setStatus(WS_STATUS.AUTH_ERROR);
          return;
        }

        if (event.code === WS_CLOSE.DUPLICATE_CONN) {
          // Duplicate connection — tab này bị replace bởi tab/device mới, không reconnect
          setStatus(WS_STATUS.CLOSED);
          return;
        }

        if (intentionalClose.current) return;

        // Ghi nhận thời điểm drop để sau khi reconnect biết fetch messages từ lúc nào
        if (disconnectedAt.current === null) {
          disconnectedAt.current = new Date().toISOString();
        }

        if (event.code === WS_CLOSE.TOKEN_EXPIRED) {
          // Token expired — force refresh rồi reconnect ngay
          auth.currentUser
            ?.getIdToken(true)
            .then(() => connect())
            .catch(() => {
              setStatus(WS_STATUS.AUTH_ERROR);
            });
          return;
        }

        // 1001 (gateway restart) hoặc các close code khác → exponential backoff
        const delay = getBackoffDelay(retryCount.current);
        retryCount.current += 1;
        setTimeout(connect, delay);
      };

      ws.onerror = () => setStatus('closed');

      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === WS_SERVER_TYPE.MESSAGE || frame.type === WS_SERVER_TYPE.SYSTEM) {
            setMessages((prev) => [...prev, frame]);
          } else if (frame.type === WS_SERVER_TYPE.ERROR) {
            setLastWsError({ code: frame.code, messageId: frame.messageId ?? null, reason: frame.reason ?? null });
          }
          // pong: ignore
        } catch {
          // ignore parse errors
        }
      };
    } catch {
      if (!intentionalClose.current) {
        const delay = getBackoffDelay(retryCount.current);
        retryCount.current += 1;
        setTimeout(connect, delay);
      }
    }
  }, []);

  useEffect(() => {
    intentionalClose.current = false;
    connect();
    return () => {
      intentionalClose.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((roomId, content) => {
    wsRef.current?.send(JSON.stringify({ type: WS_CLIENT_TYPE.MESSAGE, roomId, content }));
  }, []);

  return { messages, status, sendMessage, reconnectedAt, lastWsError };
}

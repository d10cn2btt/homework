// useWebSocket.js
// Hook subscribe vào WsManager singleton để nhận WS events.
// Không tự quản lý WS lifecycle — chỉ connect khi mount, unsubscribe khi unmount.
// Disconnect thật sự (ws.close) chỉ xảy ra khi wsManager.disconnect() được gọi (logout).

import { useEffect, useState, useCallback } from 'react';
import { wsManager } from '../services/ws-manager.js';

export function useWebSocket() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(() => wsManager.getStatus());
  const [lastWsError, setLastWsError] = useState(null);
  const [reconnectedAt, setReconnectedAt] = useState(null);

  useEffect(() => {
    wsManager.connect();

    const unsubMessage     = wsManager.on('message',     (frame) => setMessages((prev) => [...prev, frame]));
    const unsubStatus      = wsManager.on('status',      setStatus);
    const unsubReconnected = wsManager.on('reconnected', setReconnectedAt);
    const unsubError       = wsManager.on('wsError',     setLastWsError);

    return () => {
      unsubMessage();
      unsubStatus();
      unsubReconnected();
      unsubError();
    };
  }, []);

  const sendMessage = useCallback((roomId, content) => {
    wsManager.send(roomId, content);
  }, []);

  return { messages, status, sendMessage, reconnectedAt, lastWsError };
}

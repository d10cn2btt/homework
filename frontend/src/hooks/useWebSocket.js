import { useEffect, useRef, useState, useCallback } from 'react';
import { auth } from '../config/firebase';

export function useWebSocket() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('connecting');
  const wsRef = useRef(null);
  const intentionalClose = useRef(false);

  const connect = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const host = window.location.host;
      const ws = new WebSocket(`ws://${host}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => setStatus('open');
      ws.onclose = () => {
        setStatus('closed');
        if (!intentionalClose.current) {
          setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => setStatus('closed');
      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === 'message') {
            setMessages((prev) => [...prev, frame]);
          }
        } catch {
          // ignore parse errors
        }
      };
    } catch {
      setTimeout(connect, 3000);
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
    wsRef.current?.send(JSON.stringify({ type: 'message', roomId, content }));
  }, []);

  return { messages, status, sendMessage };
}

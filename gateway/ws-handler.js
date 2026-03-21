import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import registry from './conn-registry.js';
import { verifyToken } from './ws-auth.js';
import { WS_CLOSE, WS_CLIENT_TYPE, wsError, WS_ERROR } from './ws-protocol.js';

const NGINX_URL = process.env.NGINX_URL;
const GATEWAY_SELF_URL = process.env.GATEWAY_SELF_URL;

export async function handleConnection(ws, req) {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  let userId;
  try {
    const decoded = await verifyToken(token);
    userId = decoded.uid;
    const msUntilExpiry = decoded.exp * 1000 - Date.now() - 60_000;
    setTimeout(() => ws.close(WS_CLOSE.TOKEN_EXPIRED), msUntilExpiry);
  } catch {
    ws.close(WS_CLOSE.TOKEN_INVALID);
    return;
  }

  const connId = uuidv4();
  registry.set(connId, ws);

  await axios.post(`${NGINX_URL}/internal/ws/connect`, {
    userId,
    connId,
    gatewayUrl: GATEWAY_SELF_URL,
  });

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data);

      // Ping từ FE để giữ connection alive — xử lý tại Gateway, không forward lên Instance
      if (parsed.type === WS_CLIENT_TYPE.PING) {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      await axios.post(`${NGINX_URL}/internal/ws/message`, {
        from: userId,
        connId,
        roomId: parsed.roomId,
        content: parsed.content,
      });
    } catch {
      ws.send(JSON.stringify(wsError(WS_ERROR.INTERNAL_ERROR)));
    }
  });

  ws.on('close', async () => {
    registry.delete(connId);
    await axios.post(`${NGINX_URL}/internal/ws/disconnect`, { userId, connId });
  });

  ws.on('error', (err) => {
    console.error(`[ws] connId=${connId}`, err);
    ws.close();
  });
}

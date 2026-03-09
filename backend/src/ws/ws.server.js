const { WebSocketServer } = require('ws');
const { authenticateWS } = require('./ws.auth');
const { handleMessage } = require('./ws.handler');

const wss = new WebSocketServer({ noServer: true });
const registry = new Map();

wss.on('connection', (ws, req, user) => {
  const { uid } = user;

  if (!registry.has(uid)) registry.set(uid, new Set());
  registry.get(uid).add(ws);

  const msUntilExpire = user.exp * 1000 - Date.now();
  if (msUntilExpire > 0) setTimeout(() => ws.close(), msUntilExpire);

  ws.on('message', (rawData) => handleMessage(ws, uid, rawData, registry));

  ws.on('close', () => {
    registry.get(uid)?.delete(ws);
    if (!registry.get(uid)?.size) registry.delete(uid);
  });
});

function attachToServer(httpServer) {
  httpServer.on('upgrade', async (req, socket, head) => {
    try {
      const user = await authenticateWS(req);
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, user));
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });
}

module.exports = { registry, attachToServer };

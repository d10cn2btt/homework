import express from 'express';
import registry from './conn-registry.js';
import { WS_ERROR } from './ws-protocol.js';
import logger from './logger.js';

const router = express.Router();

router.post('/deliver', (req, res) => {
  const { connId, payload } = req.body;

  logger.debug({ connId, type: payload?.type }, '[deliver] received');

  if (!registry.has(connId)) {
    return res.status(404).json({ success: false, error: WS_ERROR.CONN_NOT_FOUND });
  }

  const ws = registry.get(connId);
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    registry.delete(connId);
    return res.status(404).json({ success: false, error: WS_ERROR.CONN_NOT_FOUND });
  }
  res.json({ success: true });
});

export default router;

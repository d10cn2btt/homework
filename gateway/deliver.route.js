import express from 'express';
import registry from './conn-registry.js';

const router = express.Router();

router.post('/deliver', (req, res) => {
  const { connId, payload } = req.body;

  if (!registry.has(connId)) {
    return res.status(404).json({ success: false, error: 'CONN_NOT_FOUND' });
  }

  const ws = registry.get(connId);
  ws.send(JSON.stringify(payload));
  res.json({ success: true });
});

export default router;

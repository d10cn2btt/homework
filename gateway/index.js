import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { initFirebase } from './ws-auth.js';
import { handleConnection } from './ws-handler.js';
import deliverRouter from './deliver.route.js';

initFirebase();

const app = express();
app.use(express.json());
app.use(deliverRouter);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', handleConnection);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});

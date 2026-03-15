import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { attachToServer } from './ws/ws.server.js';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
attachToServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

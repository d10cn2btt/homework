import 'dotenv/config';
import http from 'http';
import app from './app.js';

// Instance là pure HTTP — WS được xử lý bởi Gateway service.
// Không attach WS server ở đây nữa.

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

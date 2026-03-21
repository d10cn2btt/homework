import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';

import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import postsRoutes from './routes/posts.routes.js';
import usersRoutes from './routes/users.routes.js';
import chatRoutes from './routes/chat.routes.js';
import internalWsRoutes from './routes/internal/ws.route.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check — trước mọi middleware, không cần auth
// Trả hostname để biết đang hit instance nào khi debug load balancing
app.get('/health', (req, res) => res.json({ status: 'ok', instance: process.env.HOSTNAME }));

// Internal routes — chỉ Gateway gọi, Nginx đã block từ bên ngoài
app.use('/internal/ws', internalWsRoutes);

// Public API routes
app.use('/api/auth', authRoutes);
app.use('/api/me', profileRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode === 500) {
    logger.error({ err, method: req.method, url: req.url }, 'Unhandled server error');
  } else {
    logger.warn({ statusCode, message: err.message, method: req.method, url: req.url }, 'Request error');
  }
  const message = statusCode === 500 ? 'Lỗi máy chủ nội bộ' : err.message;
  res.status(statusCode).json({ message });
});

const PORT = process.env.PORT || 3000;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server running');
  });
}

export default app;

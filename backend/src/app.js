require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const postsRoutes = require('./routes/posts.routes');
const usersRoutes = require('./routes/users.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/me', profileRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

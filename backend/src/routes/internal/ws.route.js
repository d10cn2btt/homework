// Route nội bộ — chỉ Gateway mới gọi, không có auth middleware.
// Nginx block /internal với client bên ngoài nên không cần bảo vệ thêm.

import { Router } from 'express';
import { handleConnect, handleMessage, handleDisconnect } from '../../controllers/internal/ws.controller.js';

const router = Router();

// Gateway gọi khi user connect WS
router.post('/connect', handleConnect);

// Gateway gọi khi user gửi message
router.post('/message', handleMessage);

// Gateway gọi khi user đóng WS
router.post('/disconnect', handleDisconnect);

export default router;

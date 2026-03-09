import { Router } from 'express';
import authMiddleware from '../middlewares/auth.mdw.js';
import { syncUser } from '../controllers/auth.controller.js';

const router = Router();

const authenticated = [authMiddleware];

router.post('/sync', ...authenticated, syncUser);

export default router;

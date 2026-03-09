import { Router } from 'express';
import authMiddleware from '../middlewares/auth.mdw.js';
import requireRole from '../middlewares/acl.mdw.js';
import { getMe, updateMe } from '../controllers/profile.controller.js';

const router = Router();

const authenticated = [authMiddleware, requireRole()];

router.get('/', ...authenticated, getMe);
router.put('/', ...authenticated, updateMe);

export default router;

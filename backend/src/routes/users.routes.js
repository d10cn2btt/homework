import { Router } from 'express';
import authMiddleware from '../middlewares/auth.mdw.js';
import requireRole from '../middlewares/acl.mdw.js';
import * as ctrl from '../controllers/users.controller.js';

const router = Router();

const adminOnly = [authMiddleware, requireRole('ADMIN')];

router.get('/', ...adminOnly, ctrl.listUsers);
router.post('/', ...adminOnly, ctrl.createUser);
router.get('/:id', ...adminOnly, ctrl.getUserById);
router.put('/:id', ...adminOnly, ctrl.updateUser);
router.delete('/:id', ...adminOnly, ctrl.deleteUser);
router.patch('/:id/role', ...adminOnly, ctrl.assignRole);

export default router;

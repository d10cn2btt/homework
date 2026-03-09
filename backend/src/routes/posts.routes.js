import { Router } from 'express';
import authMiddleware from '../middlewares/auth.mdw.js';
import requireRole from '../middlewares/acl.mdw.js';
import * as ctrl from '../controllers/posts.controller.js';

const router = Router();

const authenticated = [authMiddleware, requireRole()];

router.get('/', ...authenticated, ctrl.listPosts);
router.post('/', ...authenticated, ctrl.createPost);
router.get('/:id', ...authenticated, ctrl.getPost);
router.put('/:id', ...authenticated, ctrl.updatePost);
router.delete('/:id', ...authenticated, ctrl.deletePost);

export default router;

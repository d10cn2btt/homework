const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.mdw');
const requireRole = require('../middlewares/acl.mdw');
const ctrl = require('../controllers/posts.controller');

const router = Router();

router.get('/', authMiddleware, requireRole(), ctrl.listPosts);
router.post('/', authMiddleware, requireRole(), ctrl.createPost);
router.get('/:id', authMiddleware, requireRole(), ctrl.getPost);
router.put('/:id', authMiddleware, requireRole(), ctrl.updatePost);
router.delete('/:id', authMiddleware, requireRole(), ctrl.deletePost);

module.exports = router;

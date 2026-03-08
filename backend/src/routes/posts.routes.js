const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.mdw');
const requireRole = require('../middlewares/acl.mdw');
const ctrl = require('../controllers/posts.controller');

const router = Router();

const authenticated = [authMiddleware, requireRole()];

router.get('/', ...authenticated, ctrl.listPosts);
router.post('/', ...authenticated, ctrl.createPost);
router.get('/:id', ...authenticated, ctrl.getPost);
router.put('/:id', ...authenticated, ctrl.updatePost);
router.delete('/:id', ...authenticated, ctrl.deletePost);

module.exports = router;

const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.mdw');
const requireRole = require('../middlewares/acl.mdw');
const ctrl = require('../controllers/users.controller');

const router = Router();

const adminOnly = [authMiddleware, requireRole('ADMIN')];

router.get('/', ...adminOnly, ctrl.listUsers);
router.post('/', ...adminOnly, ctrl.createUser);
router.get('/:id', ...adminOnly, ctrl.getUserById);
router.put('/:id', ...adminOnly, ctrl.updateUser);
router.delete('/:id', ...adminOnly, ctrl.deleteUser);
router.patch('/:id/role', ...adminOnly, ctrl.assignRole);

module.exports = router;

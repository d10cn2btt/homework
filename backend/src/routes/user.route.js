const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.mdw');
const { requireRole } = require('../middlewares/acl.mdw');
const { list, get, create, update, remove, updateRole } = require('../controllers/user.controller');

router.use(authMiddleware, requireRole('ADMIN'));

router.get('/', list);
router.get('/:id', get);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.put('/:id/role', updateRole);

module.exports = router;

const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.mdw');
const requireRole = require('../middlewares/acl.mdw');
const { getMe, updateMe } = require('../controllers/profile.controller');

const router = Router();

router.get('/', authMiddleware, requireRole(), getMe);
router.put('/', authMiddleware, requireRole(), updateMe);

module.exports = router;

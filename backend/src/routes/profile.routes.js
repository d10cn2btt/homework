const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.mdw');
const requireRole = require('../middlewares/acl.mdw');
const { getMe, updateMe } = require('../controllers/profile.controller');

const router = Router();

const authenticated = [authMiddleware, requireRole()];

router.get('/', ...authenticated, getMe);
router.put('/', ...authenticated, updateMe);

module.exports = router;

const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.mdw');
const { syncUser } = require('../controllers/auth.controller');

const router = Router();

router.post('/sync', authMiddleware, syncUser);

module.exports = router;

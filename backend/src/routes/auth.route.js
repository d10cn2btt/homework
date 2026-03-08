const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.mdw');
const { sync } = require('../controllers/auth.controller');

router.post('/sync', authMiddleware, sync);

module.exports = router;

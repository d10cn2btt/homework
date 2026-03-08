const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.mdw');
const { syncUser } = require('../controllers/auth.controller');

const router = Router();

const authenticated = [authMiddleware];

router.post('/sync', ...authenticated, syncUser);

module.exports = router;

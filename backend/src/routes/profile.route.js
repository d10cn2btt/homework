const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.mdw');
const { get, update } = require('../controllers/profile.controller');

router.use(authMiddleware);

router.get('/', get);
router.put('/', update);

module.exports = router;

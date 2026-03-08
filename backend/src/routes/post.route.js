const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.mdw');
const { list, get, create, update, remove } = require('../controllers/post.controller');

router.use(authMiddleware);

router.get('/', list);
router.get('/:id', get);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;

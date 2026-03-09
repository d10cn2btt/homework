const { Router } = require('express');
const authenticate = require('../middlewares/auth.mdw');
const { listRooms, createRoom, addMember, getMessages } = require('../controllers/chat.controller');

const router = Router();

router.get('/rooms', authenticate, listRooms);
router.post('/rooms', authenticate, createRoom);
router.post('/rooms/:roomId/members', authenticate, addMember);
router.get('/rooms/:roomId/messages', authenticate, getMessages);

module.exports = router;

import { Router } from 'express';
import authenticate from '../middlewares/auth.mdw.js';
import { listRooms, createRoom, addMember, getMessages } from '../controllers/chat.controller.js';

const router = Router();

router.get('/rooms', authenticate, listRooms);
router.post('/rooms', authenticate, createRoom);
router.post('/rooms/:roomId/members', authenticate, addMember);
router.get('/rooms/:roomId/messages', authenticate, getMessages);

export default router;

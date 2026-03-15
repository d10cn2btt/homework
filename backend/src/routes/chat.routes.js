import { Router } from 'express';
import authenticate from '../middlewares/auth.mdw.js';
import {
  listRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  renameRoom,
  deleteRoom,
  addMember,
  getMessages,
} from '../controllers/chat.controller.js';

const router = Router();

router.get('/rooms', authenticate, listRooms);
router.post('/rooms', authenticate, createRoom);
router.post('/rooms/:roomId/join', authenticate, joinRoom);
router.post('/rooms/:roomId/leave', authenticate, leaveRoom);
router.patch('/rooms/:roomId', authenticate, renameRoom);
router.delete('/rooms/:roomId', authenticate, deleteRoom);
router.post('/rooms/:roomId/members', authenticate, addMember);
router.get('/rooms/:roomId/messages', authenticate, getMessages);

export default router;

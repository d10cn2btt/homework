import * as chatService from '../services/chat.service.js';
import { ValidationError } from '../utils/errors.js';

// Broadcast giờ do saveAndBroadcast() trong chat.service.js lo qua Gateway.
// Controller không cần broadcast thủ công nữa.

async function listRooms(req, res, next) {
  try {
    const rooms = await chatService.listRooms(req.user.uid);
    res.json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
}

async function createRoom(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return next(new ValidationError('VALIDATION_ERROR'));
    const room = await chatService.createRoom(req.user.uid, name);
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

async function joinRoom(req, res, next) {
  try {
    const systemMsg = await chatService.joinRoom(req.user.uid, req.params.roomId);
    res.json({ success: true, data: systemMsg });
  } catch (err) {
    next(err);
  }
}

async function leaveRoom(req, res, next) {
  try {
    const systemMsg = await chatService.leaveRoom(req.user.uid, req.params.roomId);
    res.json({ success: true, data: systemMsg });
  } catch (err) {
    next(err);
  }
}

async function renameRoom(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return next(new ValidationError('VALIDATION_ERROR'));
    const room = await chatService.renameRoom(req.user.uid, req.params.roomId, name);
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

async function deleteRoom(req, res, next) {
  try {
    await chatService.deleteRoom(req.user.uid, req.params.roomId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId) return next(new ValidationError('VALIDATION_ERROR'));
    await chatService.addMember(req.user.uid, req.params.roomId, userId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const before = req.query.before || null;
    const since = req.query.since || null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    // Dùng object param để support cả before (pagination) lẫn since (missed messages)
    const result = await chatService.getRoomMessages(req.params.roomId, { before, since, limit });
    res.json({ success: true, data: result.messages, meta: { nextCursor: result.nextCursor } });
  } catch (err) {
    next(err);
  }
}

export { listRooms, createRoom, joinRoom, leaveRoom, renameRoom, deleteRoom, addMember, getMessages };

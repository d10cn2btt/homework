const chatService = require('../services/chat.service');
const { ValidationError } = require('../utils/errors');

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
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const result = await chatService.getRoomMessages(req.params.roomId, before, limit);
    res.json({ success: true, data: result.messages, meta: { nextCursor: result.nextCursor } });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRooms, createRoom, addMember, getMessages };

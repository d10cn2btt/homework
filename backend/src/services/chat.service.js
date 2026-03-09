import prisma from '../config/db.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';

async function checkMembership(uid, roomId) {
  const member = await prisma.roomMember.findUnique({
    where: { room_id_user_id: { room_id: roomId, user_id: uid } },
  });
  return member !== null;
}

async function getRoomMembers(roomId) {
  const members = await prisma.roomMember.findMany({
    where: { room_id: roomId },
    select: { user_id: true },
  });
  return members.map((m) => m.user_id);
}

async function saveMessage(uid, roomId, content) {
  const msg = await prisma.message.create({
    data: { room_id: roomId, sender_id: uid, content },
    include: { sender: { select: { id: true, display_name: true } } },
  });
  return {
    id: msg.id,
    roomId: msg.room_id,
    senderId: msg.sender_id,
    senderName: msg.sender.display_name,
    content: msg.content,
    createdAt: msg.created_at,
  };
}

async function getRoomMessages(roomId, before, limit = 50) {
  const messages = await prisma.message.findMany({
    where: { room_id: roomId, ...(before && { id: { lt: before } }) },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: { sender: { select: { display_name: true } } },
  });
  const mapped = messages.map((m) => ({
    id: m.id,
    roomId: m.room_id,
    senderId: m.sender_id,
    senderName: m.sender.display_name,
    content: m.content,
    createdAt: m.created_at,
  }));
  return { messages: mapped, nextCursor: messages.length === limit ? messages.at(-1).id : null };
}

async function listRooms(uid) {
  const memberships = await prisma.roomMember.findMany({
    where: { user_id: uid },
    include: { room: { include: { messages: { orderBy: { created_at: 'desc' }, take: 1 } } } },
  });
  return memberships.map(({ room }) => ({
    id: room.id,
    name: room.name,
    lastMessage: room.messages[0]
      ? { content: room.messages[0].content, createdAt: room.messages[0].created_at }
      : null,
  }));
}

async function createRoom(uid, name) {
  const room = await prisma.room.create({
    data: { name, created_by: uid, members: { create: { user_id: uid } } },
  });
  return { id: room.id, name: room.name };
}

async function addMember(actorUid, roomId, targetUid) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND');
  if (room.created_by !== actorUid) throw new ForbiddenError('FORBIDDEN');

  const targetUser = await prisma.user.findUnique({ where: { id: targetUid } });
  if (!targetUser) throw new NotFoundError('USER_NOT_FOUND');

  try {
    await prisma.roomMember.create({ data: { room_id: roomId, user_id: targetUid } });
  } catch (err) {
    if (err.code === 'P2002') throw new ConflictError('ALREADY_MEMBER');
    throw err;
  }
}

export { checkMembership, getRoomMembers, saveMessage, getRoomMessages, listRooms, createRoom, addMember };

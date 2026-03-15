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
    data: { room_id: roomId, sender_id: uid, type: 'USER', content },
    include: { sender: { select: { id: true, display_name: true } } },
  });
  return {
    id: msg.id,
    roomId: msg.room_id,
    type: msg.type,
    senderId: msg.sender_id,
    senderName: msg.sender.display_name,
    content: msg.content,
    createdAt: msg.created_at,
  };
}

function mapMessage(m) {
  return {
    id: m.id,
    roomId: m.room_id,
    type: m.type,
    senderId: m.sender_id,
    senderName: m.sender?.display_name ?? null,
    content: m.content,
    createdAt: m.created_at,
  };
}

async function getRoomMessages(roomId, before, limit = 50) {
  const messages = await prisma.message.findMany({
    where: { room_id: roomId, ...(before && { id: { lt: before } }) },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: { sender: { select: { display_name: true } } },
  });
  return {
    messages: messages.map(mapMessage),
    nextCursor: messages.length === limit ? messages.at(-1).id : null,
  };
}

async function listRooms(uid) {
  const rooms = await prisma.room.findMany({
    where: { deleted_at: null },
    include: {
      members: { where: { user_id: uid }, select: { user_id: true } },
      messages: { orderBy: { created_at: 'desc' }, take: 1 },
    },
    orderBy: { created_at: 'desc' },
  });
  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    isOwner: room.created_by === uid,
    isMember: room.members.length > 0,
    lastMessage: room.messages[0]
      ? { content: room.messages[0].content, createdAt: room.messages[0].created_at }
      : null,
  }));
}

async function createRoom(uid, name) {
  const room = await prisma.room.create({
    data: { name, created_by: uid, members: { create: { user_id: uid } } },
  });
  return { id: room.id, name: room.name, isOwner: true, isMember: true, lastMessage: null };
}

async function joinRoom(uid, roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId, deleted_at: null } });
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND');

  try {
    await prisma.roomMember.create({ data: { room_id: roomId, user_id: uid } });
  } catch (err) {
    if (err.code === 'P2002') throw new ConflictError('ALREADY_MEMBER');
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: uid }, select: { display_name: true } });
  const msg = await prisma.message.create({
    data: { room_id: roomId, sender_id: null, type: 'SYSTEM', content: `${user.display_name} đã tham gia room` },
  });
  return mapMessage({ ...msg, sender: null });
}

async function leaveRoom(uid, roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId, deleted_at: null } });
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND');

  const membership = await prisma.roomMember.findUnique({
    where: { room_id_user_id: { room_id: roomId, user_id: uid } },
  });
  if (!membership) throw new ForbiddenError('NOT_MEMBER');

  if (room.created_by === uid) {
    const count = await prisma.roomMember.count({ where: { room_id: roomId } });
    if (count > 1) throw new ForbiddenError('CREATOR_CANNOT_LEAVE');
  }

  const user = await prisma.user.findUnique({ where: { id: uid }, select: { display_name: true } });
  const [, msg] = await prisma.$transaction([
    prisma.roomMember.delete({ where: { room_id_user_id: { room_id: roomId, user_id: uid } } }),
    prisma.message.create({
      data: { room_id: roomId, sender_id: null, type: 'SYSTEM', content: `${user.display_name} đã rời room` },
    }),
  ]);
  return mapMessage({ ...msg, sender: null });
}

async function renameRoom(uid, roomId, name) {
  const room = await prisma.room.findUnique({ where: { id: roomId, deleted_at: null } });
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND');
  if (room.created_by !== uid) throw new ForbiddenError('FORBIDDEN');

  const updated = await prisma.room.update({ where: { id: roomId }, data: { name } });
  return { id: updated.id, name: updated.name };
}

async function deleteRoom(uid, roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId, deleted_at: null } });
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND');
  if (room.created_by !== uid) throw new ForbiddenError('FORBIDDEN');

  await prisma.room.update({ where: { id: roomId }, data: { deleted_at: new Date() } });
}

export {
  checkMembership,
  getRoomMembers,
  saveMessage,
  getRoomMessages,
  listRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  renameRoom,
  deleteRoom,
};

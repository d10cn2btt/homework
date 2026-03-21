import prisma from '../config/db.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { deliver } from './gateway-client.service.js';
import * as wsRegistry from './ws-registry.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Chuẩn hóa message object trả về — dùng chung cho mọi nơi cần trả message
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

// Kiểm tra user có phải member của room không
async function checkMembership(uid, roomId) {
  const member = await prisma.roomMember.findUnique({
    where: { room_id_user_id: { room_id: roomId, user_id: uid } },
  });
  return member !== null;
}

// Lấy danh sách userId của tất cả members trong room
async function getRoomMembers(roomId) {
  const members = await prisma.roomMember.findMany({
    where: { room_id: roomId },
    select: { user_id: true },
  });
  return members.map((m) => m.user_id);
}

// ─── Message ──────────────────────────────────────────────────────────────────

// Lưu 1 message vào DB và trả về message đã được mapMessage
async function saveMessage(uid, roomId, content) {
  const msg = await prisma.message.create({
    data: { room_id: roomId, sender_id: uid, type: 'USER', content },
    include: { sender: { select: { id: true, display_name: true } } },
  });
  return mapMessage(msg);
}

// Lưu message vào DB rồi broadcast realtime tới tất cả members đang online.
// Được gọi từ internal ws.controller khi Gateway forward message từ WS client.
async function saveAndBroadcast(fromId, roomId, content) {
  // 1. Lưu DB
  const message = await saveMessage(fromId, roomId, content);

  // 2. Lấy tất cả members của room
  const memberIds = await getRoomMembers(roomId);

  // 3. Deliver realtime tới từng member đang online
  let deliveredCount = 0;
  for (const memberId of memberIds) {
    // Lookup Redis — nếu empty thì member đang offline, bỏ qua
    const entries = await wsRegistry.lookup(memberId);
    for (const { connId, gatewayUrl } of entries) {
      const result = await deliver(gatewayUrl, connId, memberId, {
        type: 'message',
        data: message,
      });
      if (result.success) deliveredCount++;
    }
  }

  // 4. Nếu deliver được ít nhất 1 → update status = DELIVERED
  if (deliveredCount > 0) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'DELIVERED' },
    });
  }

  return { messageId: message.id, deliveredCount };
}

// Lấy lịch sử message của room với cursor-based pagination.
// - before: messageId — lấy các message trước cursor này (load more)
// - since: ISO timestamp — lấy các message sau thời điểm này (fetch missed messages khi reconnect)
async function getRoomMessages(roomId, { before, since, limit = 50 } = {}) {
  const messages = await prisma.message.findMany({
    where: {
      room_id: roomId,
      ...(before && { id: { lt: before } }),
      ...(since && { created_at: { gt: new Date(since) } }),
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: { sender: { select: { display_name: true } } },
  });
  return {
    messages: messages.map(mapMessage),
    nextCursor: messages.length === limit ? messages.at(-1).id : null,
  };
}

// ─── Room ─────────────────────────────────────────────────────────────────────

// Lấy tất cả rooms, kèm trạng thái member và last message của mỗi room
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

// Tạo room mới và tự động add creator làm member đầu tiên
async function createRoom(uid, name) {
  const room = await prisma.room.create({
    data: { name, created_by: uid, members: { create: { user_id: uid } } },
  });
  return { id: room.id, name: room.name, isOwner: true, isMember: true, lastMessage: null };
}

// Thêm user vào room, tạo SYSTEM message thông báo
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

// Xóa user khỏi room, tạo SYSTEM message thông báo.
// Creator không được leave nếu còn member khác.
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

// Đổi tên room — chỉ creator mới được phép
async function renameRoom(uid, roomId, name) {
  const room = await prisma.room.findUnique({ where: { id: roomId, deleted_at: null } });
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND');
  if (room.created_by !== uid) throw new ForbiddenError('FORBIDDEN');

  const updated = await prisma.room.update({ where: { id: roomId }, data: { name } });
  return { id: updated.id, name: updated.name };
}

// Soft delete room — chỉ creator mới được phép
async function deleteRoom(uid, roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId, deleted_at: null } });
  if (!room) throw new NotFoundError('ROOM_NOT_FOUND');
  if (room.created_by !== uid) throw new ForbiddenError('FORBIDDEN');

  await prisma.room.update({ where: { id: roomId }, data: { deleted_at: new Date() } });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  checkMembership,
  getRoomMembers,
  saveMessage,
  saveAndBroadcast,
  getRoomMessages,
  listRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  renameRoom,
  deleteRoom,
};

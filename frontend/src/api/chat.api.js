import api from './axios';

export function listRooms() {
  return api.get('/chat/rooms').then((r) => r.data.data);
}

export function createRoom(name) {
  return api.post('/chat/rooms', { name }).then((r) => r.data.data);
}

export function addMember(roomId, userId) {
  return api.post(`/chat/rooms/${roomId}/members`, { userId }).then((r) => r.data.data);
}

export function getMessages(roomId, { before, limit } = {}) {
  const params = {};
  if (before) params.before = before;
  if (limit) params.limit = limit;
  return api.get(`/chat/rooms/${roomId}/messages`, { params }).then((r) => ({
    messages: r.data.data,
    nextCursor: r.data.meta.nextCursor,
  }));
}

import api from './axios';

export function listRooms() {
  return api.get('/chat/rooms').then((r) => r.data.data);
}

export function createRoom(name) {
  return api.post('/chat/rooms', { name }).then((r) => r.data.data);
}

export function joinRoom(roomId) {
  return api.post(`/chat/rooms/${roomId}/join`).then((r) => r.data.data);
}

export function leaveRoom(roomId) {
  return api.post(`/chat/rooms/${roomId}/leave`).then((r) => r.data.data);
}

export function renameRoom(roomId, name) {
  return api.patch(`/chat/rooms/${roomId}`, { name }).then((r) => r.data.data);
}

export function deleteRoom(roomId) {
  return api.delete(`/chat/rooms/${roomId}`).then((r) => r.data.data);
}

export function addMember(roomId, userId) {
  return api.post(`/chat/rooms/${roomId}/members`, { userId }).then((r) => r.data.data);
}

export function getMessages(roomId, { before, since, limit } = {}) {
  const params = {};
  if (before) params.before = before;
  if (since) params.since = since;
  if (limit) params.limit = limit;
  return api.get(`/chat/rooms/${roomId}/messages`, { params }).then((r) => ({
    messages: r.data.data,
    nextCursor: r.data.meta.nextCursor,
  }));
}

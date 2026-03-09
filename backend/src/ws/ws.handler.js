const chatService = require('../services/chat.service');

async function handleChatMessage(ws, uid, frame, registry) {
  const { roomId, content } = frame;

  if (!roomId || !content) {
    ws.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE' }));
    return;
  }
  if (content.length > 2000) {
    ws.send(JSON.stringify({ type: 'error', code: 'CONTENT_TOO_LONG' }));
    return;
  }

  const isMember = await chatService.checkMembership(uid, roomId);
  if (!isMember) {
    ws.send(JSON.stringify({ type: 'error', code: 'FORBIDDEN' }));
    return;
  }

  const savedMessage = await chatService.saveMessage(uid, roomId, content);
  const memberUids = await chatService.getRoomMembers(roomId);
  const outbound = JSON.stringify({ type: 'message', ...savedMessage });

  memberUids.forEach((memberUid) => {
    registry.get(memberUid)?.forEach((sock) => sock.send(outbound));
  });
}

async function handleMessage(ws, uid, rawData, registry) {
  try {
    const frame = JSON.parse(rawData.toString());
    if (frame.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    } else if (frame.type === 'message') {
      await handleChatMessage(ws, uid, frame, registry);
    } else {
      ws.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE' }));
    }
  } catch {
    ws.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE' }));
  }
}

module.exports = { handleMessage };

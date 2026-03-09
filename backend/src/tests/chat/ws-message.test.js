jest.mock('../../config/firebase.js', () => ({
  auth: jest.fn(),
}));

jest.mock('../../config/db.js', () => ({
  user: { findUnique: jest.fn() },
}));

jest.mock('../../services/chat.service.js');

import http from 'http';
import WebSocket from 'ws';
import app from '../../app.js';
import { attachToServer } from '../../ws/ws.server.js';
import admin from '../../config/firebase.js';
import * as chatService from '../../services/chat.service.js';

let server;
let port;

const userA = { uid: 'userA', email: 'a@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
const userB = { uid: 'userB', email: 'b@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };

beforeAll((done) => {
  server = http.createServer(app);
  attachToServer(server);
  server.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

function openWS(user) {
  admin.auth.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue(user),
  });
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${user.uid}-token`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test('A and B in same room — A sends message → B receives it', (done) => {
  const savedMsg = { id: 'msg1', roomId: 'room1', senderId: userA.uid, senderName: 'UserA', content: 'hello', createdAt: new Date() };
  chatService.checkMembership.mockResolvedValue(true);
  chatService.saveMessage.mockResolvedValue(savedMsg);
  chatService.getRoomMembers.mockResolvedValue([userA.uid, userB.uid]);

  Promise.all([openWS(userA), openWS(userB)]).then(([wsA, wsB]) => {
    wsB.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'message') {
        expect(msg.content).toBe('hello');
        expect(msg.senderId).toBe(userA.uid);
        wsA.close();
        wsB.close();
        done();
      }
    });
    setTimeout(() => {
      wsA.send(JSON.stringify({ type: 'message', roomId: 'room1', content: 'hello' }));
    }, 50);
  });
});

test('user sends to room they are not a member of → FORBIDDEN', (done) => {
  chatService.checkMembership.mockResolvedValue(false);

  openWS(userA).then((ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('FORBIDDEN');
      ws.close();
      done();
    });
    ws.send(JSON.stringify({ type: 'message', roomId: 'other-room', content: 'hi' }));
  });
});

test('content > 2000 chars → CONTENT_TOO_LONG', (done) => {
  openWS(userA).then((ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('CONTENT_TOO_LONG');
      ws.close();
      done();
    });
    ws.send(JSON.stringify({ type: 'message', roomId: 'room1', content: 'x'.repeat(2001) }));
  });
});

test('missing roomId → INVALID_MESSAGE', (done) => {
  openWS(userA).then((ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('INVALID_MESSAGE');
      ws.close();
      done();
    });
    ws.send(JSON.stringify({ type: 'message', content: 'no-room' }));
  });
});

test('missing content → INVALID_MESSAGE', (done) => {
  openWS(userA).then((ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('INVALID_MESSAGE');
      ws.close();
      done();
    });
    ws.send(JSON.stringify({ type: 'message', roomId: 'room1' }));
  });
});

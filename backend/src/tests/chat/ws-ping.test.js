const http = require('http');
const WebSocket = require('ws');
const app = require('../../app');
const { attachToServer } = require('../../ws/ws.server');
const admin = require('../../config/firebase');

jest.mock('../../config/firebase', () => ({
  auth: jest.fn(),
}));

jest.mock('../../config/db', () => ({
  user: { findUnique: jest.fn() },
}));

let server;
let port;

beforeAll((done) => {
  admin.auth.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-ping', email: 'ping@test.com', exp: Math.floor(Date.now() / 1000) + 3600 }),
  });
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

function openWS() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=valid`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test('ping → pong', (done) => {
  openWS().then((ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('pong');
      ws.close();
      done();
    });
    ws.send(JSON.stringify({ type: 'ping' }));
  });
});

test('malformed JSON → INVALID_MESSAGE error', (done) => {
  openWS().then((ws) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('INVALID_MESSAGE');
      ws.close();
      done();
    });
    ws.send('not-json-at-all{{{');
  });
});

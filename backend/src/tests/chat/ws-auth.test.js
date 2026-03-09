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

function connectWS(token) {
  const url = token ? `ws://localhost:${port}/ws?token=${token}` : `ws://localhost:${port}/ws`;
  return new WebSocket(url);
}

test('valid token → connection open', (done) => {
  admin.auth.mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user1', email: 'u@test.com', exp: Math.floor(Date.now() / 1000) + 3600 }),
  });

  const ws = connectWS('valid-token');
  ws.on('open', () => {
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    done();
  });
  ws.on('error', done);
});

test('no token → connection rejected', (done) => {
  const ws = connectWS(null);
  ws.on('close', () => done());
  ws.on('error', () => done());
});

test('invalid token → connection rejected', (done) => {
  admin.auth.mockReturnValue({
    verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid token')),
  });

  const ws = connectWS('invalid-token');
  ws.on('close', () => done());
  ws.on('error', () => done());
});

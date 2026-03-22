# Chat Load Balancing — Code Walkthrough

> Tài liệu này giải thích **code cụ thể**: vai trò từng file và luồng thực thi qua từng dòng code.
> Xem kiến trúc tổng thể tại [`docs/chat-load-balancing.md`](chat-load-balancing.md).

---

## Phần 1 — Code Flow theo từng workflow

### Flow 1: User A kết nối

```
browser                    gateway/ws-handler.js         backend (instance)
──────────────────────     ──────────────────────────    ───────────────────────────────
new WebSocket(url)
  └─ ?token=<token>   →   handleConnection(ws, req)
                            verifyToken(token)
                            │  └─ ws-auth.js
                            │     firebase.verifyIdToken()
                            │     → { uid, exp }
                            │
                            connId = uuidv4()
                            registry.set(connId, ws)
                            │  └─ conn-registry.js (RAM)
                            │
                            axios.POST /internal/ws/connect
                            { userId, connId, gatewayUrl }  →  ws.route.js → handleConnect()
                                                                 wsRegistry.register(userId, connId, gw)
                                                                 │  └─ ws-registry.service.js
                                                                 │     redis.get(key) → parse → push → redis.set
                                                                 200 { ok: true }
```

---

### Flow 2: A gửi message "hello" vào room

```
browser                   gateway/ws-handler.js       backend (instance)            gateway/deliver.route.js
──────────────────────    ──────────────────────────  ──────────────────────────── ─────────────────────────
ws.send({                →  ws.on('message')
  type: 'message',          parsed = JSON.parse(data)
  roomId: 'r1',
  content: 'hello'          if ping → pong, return
})
                            axios.POST /internal/ws/message
                            { from:A, roomId:r1, content }  →  handleMessage()
                                                                 saveAndBroadcast(A, r1, 'hello')
                                                                 │  └─ chat.service.js
                                                                 │
                                                                 │  1. saveMessage(A, r1, 'hello')
                                                                 │     prisma.message.create()
                                                                 │     → message { id, status:SENT, ... }
                                                                 │
                                                                 │  2. getRoomMembers(r1)
                                                                 │     prisma.roomMember.findMany()
                                                                 │     → [A, B, C]
                                                                 │
                                                                 │  3. for each member:
                                                                 │     wsRegistry.lookup(A) → [{connId:abc,gw}]
                                                                 │     wsRegistry.lookup(B) → [{connId:xyz,gw}]
                                                                 │     wsRegistry.lookup(C) → []  (offline)
                                                                 │
                                                                 │  4. deliver(gw, abc, A, payload)
                                                                 │     └─ gateway-client.service.js
                                                                 │        axios.POST gw/deliver {connId:abc}
                                                                 │        →  registry.get('abc') → ws_A
                                                                       ws_A.send(payload)   →  A nhận
                                                                 │        ← 200 {success:true}
                                                                 │
                                                                 │     deliver(gw, xyz, B, payload)
                                                                 │        axios.POST gw/deliver {connId:xyz}
                                                                 │        →  registry.get('xyz') → ws_B
                                                                       ws_B.send(payload)   →  B nhận
                                                                 │
                                                                 │  5. deliveredCount=2 > 0
                                                                 │     prisma.message.update(DELIVERED)
                                                                 │
                                                                 200 { ok:true, data:{messageId, deliveredCount:2} }
```

---

### Flow 3: Deliver fail — CONN_NOT_FOUND

Xảy ra khi Gateway restart đột ngột, in-memory registry mất nhưng Redis còn entry cũ.

```
backend (instance)                gateway/deliver.route.js
────────────────────────────      ──────────────────────────────────
deliver(gw, 'abc', userId, ...)
  axios.POST gw/deliver           →  registry.has('abc') → false  (Gateway vừa restart)
                                     ← 404 { error: 'CONN_NOT_FOUND' }

  err.response.status === 404
  → deregister(userId, 'abc')        (xóa stale entry khỏi Redis)
  → return { success: false }        (không retry — 404 là permanent)
  → deliveredCount không tăng
  → message giữ status: SENT

[Khi user reconnect]
  useWebSocket.js:
    disconnectedAt.current = "2026-03-21T10:00:00Z"

  [Reconnect thành công]
    setReconnectedAt("2026-03-21T10:00:00Z")

  ChatPage.jsx:
    useEffect([reconnectedAt]) →
      getMessages(roomId, { since: "2026-03-21T10:00:00Z" })
      → GET /api/chat/rooms/r1/messages?since=...
      → prisma.message.findMany({ created_at: { gt: new Date(since) } })
      → user nhận đủ messages bỏ lỡ
```

---

### Flow 4: Token expired trong session

```
gateway/ws-handler.js
──────────────────────────────────────────────────────────
[Tại thời điểm connect]
  decoded = verifyToken(token) → { uid, exp: 1740000000 }
  msUntilExpiry = 1740000000 * 1000 - Date.now() - 60_000
  setTimeout(() => ws.close(WS_CLOSE.TOKEN_EXPIRED), msUntilExpiry)

[60s trước khi token hết hạn]
  ws.close(4002)  →  browser

useWebSocket.js
──────────────────────────────────────────────────────────
  ws.onclose({ code: 4002 })
    if disconnectedAt === null:
      disconnectedAt = new Date().toISOString()
    auth.currentUser.getIdToken(true)   ← force refresh
      .then(() => connect())            ← reconnect với token mới
                                          (onopen → setReconnectedAt → fetch missed)
```

---

### Flow 5: Multi-device delivery

User A đang mở laptop (connId: `abc`) và điện thoại (connId: `def`) cùng lúc.

```
ws-registry.service.js (Redis)
──────────────────────────────
ws:registry:userA = [
  { connId: "abc", gatewayUrl: "http://gw:8080" },  ← laptop
  { connId: "def", gatewayUrl: "http://gw:8080" },  ← điện thoại
]

chat.service.js — saveAndBroadcast()
──────────────────────────────
const entries = await wsRegistry.lookup(userA);
// → [{ connId:"abc",...}, { connId:"def",... }]

for (const { connId, gatewayUrl } of entries) {
  await deliver(gatewayUrl, connId, userA, payload);
}
// deliver("abc") → ws_laptop.send()   → laptop nhận ✓
// deliver("def") → ws_phone.send()    → điện thoại nhận ✓
// deliveredCount = 2
```

---

### Flow 6: WS error frame → Toast notification

```
gateway/ws-handler.js
──────────────────────────────────────────────────────────
ws.on('message', async (data) => {
  try {
    await axios.post(NGINX_URL + '/internal/ws/message', ...)
  } catch {
    ws.send(JSON.stringify(wsError(WS_ERROR.INTERNAL_ERROR)))
    // → { type: 'error', code: 'INTERNAL_ERROR' }
  }
});

useWebSocket.js
──────────────────────────────────────────────────────────
ws.onmessage = (event) => {
  const frame = JSON.parse(event.data);
  if (frame.type === 'error')
    setLastWsError({ code: frame.code, ... })
};

ChatPage.jsx
──────────────────────────────────────────────────────────
useEffect(() => {
  if (!lastWsError) return;
  setError(ERROR_MESSAGES[lastWsError.code] ?? 'Lỗi kết nối.');
}, [lastWsError]);
// → render error banner, auto-dismiss sau 4s
```

---

## Phần 2 — Dependency graph

```
Gateway side
────────────────────────────────────────────
index.js
  ├── ws-auth.js         (initFirebase, verifyToken)
  ├── ws-handler.js      (handleConnection)
  │     ├── ws-auth.js   (verifyToken)
  │     ├── conn-registry.js (set/delete)
  │     └── ws-protocol.js   (WS_CLOSE, WS_CLIENT_TYPE, wsError)
  ├── deliver.route.js   (POST /deliver)
  │     └── conn-registry.js (has, get, delete)
  └── ws-protocol.js     (constants only)

Instance side
────────────────────────────────────────────
app.js
  └── routes/internal/ws.route.js
        └── controllers/internal/ws.controller.js
              ├── services/ws-registry.service.js  (register, deregister)
              │     └── config/redis.js
              └── services/chat.service.js         (saveAndBroadcast)
                    ├── config/db.js               (prisma)
                    ├── services/ws-registry.service.js (lookup)
                    └── services/gateway-client.service.js (deliver)
                          ├── axios
                          └── services/ws-registry.service.js (deregister)

Frontend side
────────────────────────────────────────────
ChatPage.jsx
  ├── hooks/useWebSocket.js
  │     └── config/firebase.js (auth.currentUser.getIdToken)
  └── api/chat.api.js
        └── api/axios.js
```

---

## Phần 3 — Vai trò từng file

### Gateway (`gateway/`)

---

#### `index.js` — Entry point

```js
initFirebase();                          // khởi tạo Firebase Admin SDK (1 lần duy nhất)

const app = express();
app.use(express.json());
app.use(deliverRouter);                  // mount POST /deliver
app.get('/health', ...);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });  // WS và HTTP dùng chung 1 port (8080)

wss.on('connection', handleConnection);  // mỗi WS connect mới → gọi ws-handler.js
server.listen(PORT);
```

**Vai trò:** Boot service. Gắn HTTP server (phục vụ `/deliver`) và WS server (phục vụ browser) lên cùng port 8080. Không chứa logic.

---

#### `ws-auth.js` — Firebase token verification

```js
export function initFirebase() {
  if (admin.apps.length) return;        // idempotent — chỉ init 1 lần
  admin.initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export async function verifyToken(token) {
  const decoded = await admin.auth().verifyIdToken(token);
  return { uid: decoded.uid, exp: decoded.exp };  // trả uid + thời điểm expire
}
```

**Vai trò:** Duy nhất 1 việc — verify Firebase ID Token và trả `{ uid, exp }`. Tách ra file riêng để dễ mock trong test.

---

#### `conn-registry.js` — In-memory connection store

```js
const registry = new Map();  // sống trong RAM của Gateway process

export default {
  set(connId, ws)  { registry.set(connId, ws); },
  get(connId)      { return registry.get(connId); },
  delete(connId)   { registry.delete(connId); },
  has(connId)      { return registry.has(connId); },
};
```

**Vai trò:** `Map<connId, ws>` — ánh xạ từ connId (UUID) sang WebSocket object thực. Là nguồn sự thật duy nhất cho "user nào đang có WS connection tại Gateway này". Mất khi process restart.

---

#### `ws-protocol.js` — Protocol constants

```js
export const WS_CLOSE = {
  NORMAL: 1000, GOING_AWAY: 1001,
  TOKEN_INVALID: 4001, TOKEN_EXPIRED: 4002, DUPLICATE_CONN: 4003,
};

export const WS_ERROR = {
  DELIVER_FAILED: 'DELIVER_FAILED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export const WS_CLIENT_TYPE = { PING: 'ping', MESSAGE: 'message' };
export const WS_SERVER_TYPE = { PONG: 'pong', MESSAGE: 'message', SYSTEM: 'system', ERROR: 'error' };

export const wsError = (code, extra = {}) => ({ type: 'error', code, ...extra });
```

**Vai trò:** Single source of truth cho tất cả hằng số protocol. Frontend tham chiếu tài liệu này để biết phải handle những gì. Không chứa logic.

---

#### `ws-handler.js` — WS connection lifecycle

File quan trọng nhất ở Gateway. Xử lý toàn bộ vòng đời của 1 WS connection.

```js
export async function handleConnection(ws, req) {
  // ── 1. Parse và verify token ──────────────────────────────────────────────
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  let userId;
  try {
    const decoded = await verifyToken(token);
    userId = decoded.uid;

    // set timer để tự đóng 60s trước khi token hết hạn
    const msUntilExpiry = decoded.exp * 1000 - Date.now() - 60_000;
    setTimeout(() => ws.close(WS_CLOSE.TOKEN_EXPIRED), msUntilExpiry);
  } catch {
    ws.close(WS_CLOSE.TOKEN_INVALID);  // token sai → đóng ngay, không lưu gì
    return;
  }

  // ── 2. Đăng ký connection ─────────────────────────────────────────────────
  const connId = uuidv4();
  registry.set(connId, ws);           // lưu vào RAM: connId → ws socket

  // báo Instance biết user online (Instance lưu vào Redis)
  await axios.post(`${NGINX_URL}/internal/ws/connect`, {
    userId, connId, gatewayUrl: GATEWAY_SELF_URL,
  });

  // ── 3. Xử lý message từ browser ──────────────────────────────────────────
  ws.on('message', async (data) => {
    const parsed = JSON.parse(data);

    if (parsed.type === WS_CLIENT_TYPE.PING) {
      ws.send(JSON.stringify({ type: 'pong' }));  // xử lý tại chỗ, không forward
      return;
    }

    // forward message xuống Instance để persist DB + broadcast
    await axios.post(`${NGINX_URL}/internal/ws/message`, {
      from: userId, connId,
      roomId: parsed.roomId, content: parsed.content,
    });
  });

  // ── 4. Xử lý đóng connection ─────────────────────────────────────────────
  ws.on('close', async () => {
    registry.delete(connId);           // xóa khỏi RAM ngay lập tức
    await axios.post(`${NGINX_URL}/internal/ws/disconnect`, { userId, connId });
  });

  ws.on('error', (err) => {
    console.error(`[ws] connId=${connId}`, err);
    ws.close();
  });
}
```

**Vai trò:** Translate WS events → HTTP calls tới Instance. Gateway không biết gì về rooms, messages, hay business logic — chỉ forward.

---

#### `deliver.route.js` — Nhận lệnh push từ Instance

```js
router.post('/deliver', (req, res) => {
  const { connId, payload } = req.body;

  if (!registry.has(connId)) {
    return res.status(404).json({ error: 'CONN_NOT_FOUND' });
  }

  const ws = registry.get(connId);
  try {
    ws.send(JSON.stringify(payload));  // đẩy message xuống browser qua WS
  } catch {
    registry.delete(connId);           // WS đang CLOSING → cleanup
    return res.status(404).json({ error: 'CONN_NOT_FOUND' });
  }

  res.json({ success: true });
});
```

**Vai trò:** Nhận `{ connId, payload }` từ Instance → tìm WS socket trong RAM → `ws.send()`. Đây là "điểm cuối" của hành trình message từ người gửi đến người nhận.

---

### Backend Instance (`backend/src/`)

---

#### `routes/internal/ws.route.js` — Khai báo internal routes

```js
router.post('/connect',    handleConnect);
router.post('/message',    handleMessage);
router.post('/disconnect', handleDisconnect);
```

**Vai trò:** Mount 3 endpoints. Không có auth middleware — bảo vệ bằng Nginx block `/internal` từ bên ngoài.

---

#### `controllers/internal/ws.controller.js` — Điều phối từ HTTP sang service

```js
export async function handleConnect(req, res, next) {
  try {
    const { userId, connId, gatewayUrl } = req.body;
    await wsRegistry.register(userId, connId, gatewayUrl);  // → Redis
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function handleMessage(req, res, next) {
  try {
    const { from, roomId, content } = req.body;
    const result = await saveAndBroadcast(from, roomId, content);  // → DB + deliver
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

export async function handleDisconnect(req, res, next) {
  try {
    const { userId, connId } = req.body;
    await wsRegistry.deregister(userId, connId);  // → Redis
    res.json({ ok: true });
  } catch (err) { next(err); }
}
```

**Vai trò:** Thin controller — parse body, gọi service, trả response. Không có logic nghiệp vụ nào ở đây.

---

#### `services/ws-registry.service.js` — Quản lý registry trong Redis

```js
const KEY = (userId) => `ws:registry:${userId}`;
const TTL = 7200;  // 2 giờ

export async function register(userId, connId, gatewayUrl) {
  const raw = await redis.get(KEY(userId));
  const entries = raw ? JSON.parse(raw) : [];  // load existing (multi-device)
  entries.push({ connId, gatewayUrl });
  await redis.set(KEY(userId), JSON.stringify(entries), 'EX', TTL);
  // → key: ws:registry:userA  value: [{connId:"abc", gatewayUrl:"http://gw:8080"}]
}

export async function deregister(userId, connId) {
  const raw = await redis.get(KEY(userId));
  if (!raw) return;

  const entries = JSON.parse(raw).filter((e) => e.connId !== connId);  // xóa đúng connId
  if (entries.length > 0) {
    await redis.set(KEY(userId), JSON.stringify(entries), 'EX', TTL);  // còn tab khác
  } else {
    await redis.del(KEY(userId));  // không còn connection → xóa key luôn
  }
}

export async function lookup(userId) {
  const raw = await redis.get(KEY(userId));
  return raw ? JSON.parse(raw) : [];  // [] = user offline
}
```

**Vai trò:** CRUD cho Redis key `ws:registry:{userId}`. Giá trị là **array** (không phải object đơn) để hỗ trợ multi-device: 1 user có thể có nhiều connIds cùng lúc.

---

#### `services/gateway-client.service.js` — HTTP client gọi Gateway `/deliver`

```js
const DELAYS = [100, 300, 1000];  // retry delays (ms)

export async function deliver(gatewayUrl, connId, userId, payload) {
  for (let i = 0; i < DELAYS.length; i++) {
    try {
      await axios.post(`${gatewayUrl}/deliver`, { connId, payload }, { timeout: 3000 });
      return { success: true };  // thành công → thoát vòng lặp
    } catch (err) {
      if (err.response?.status === 404) {
        // Gateway báo connId không tồn tại → stale entry, xóa khỏi Redis
        await deregister(userId, connId);
        return { success: false };  // không retry — 404 là permanent
      }
      // lỗi mạng → chờ rồi retry
      if (i < DELAYS.length - 1) {
        await new Promise((res) => setTimeout(res, DELAYS[i]));
      }
    }
  }
  // hết 3 lần → log, không throw (không muốn crash toàn bộ broadcast vì 1 user)
  logger.warn({ connId }, '[gateway-client] deliver failed after retries');
  return { success: false };
}
```

**Vai trò:** Reliable delivery với retry. Tự cleanup Redis khi Gateway báo `CONN_NOT_FOUND`. Không throw để đảm bảo 1 delivery fail không ảnh hưởng các members khác trong room.

---

#### `services/chat.service.js` — `saveAndBroadcast()` (phần quan trọng)

```js
async function saveAndBroadcast(fromId, roomId, content) {
  // ── Bước 1: Persist DB ────────────────────────────────────────────────────
  const message = await saveMessage(fromId, roomId, content);
  // → INSERT INTO messages (room_id, sender_id, content, status='SENT') ...

  // ── Bước 2: Lấy danh sách members trong room ──────────────────────────────
  const memberIds = await getRoomMembers(roomId);
  // → SELECT user_id FROM room_members WHERE room_id = ?

  // ── Bước 3: Fan-out deliver tới từng member đang online ───────────────────
  let deliveredCount = 0;
  for (const memberId of memberIds) {
    const entries = await wsRegistry.lookup(memberId);
    // [] = offline → bỏ qua
    // [{connId, gatewayUrl}, ...] = online (có thể nhiều device)

    for (const { connId, gatewayUrl } of entries) {
      const result = await deliver(gatewayUrl, connId, memberId, {
        type: 'message', data: message,
      });
      if (result.success) deliveredCount++;
    }
  }

  // ── Bước 4: Update status nếu có ít nhất 1 người nhận ────────────────────
  if (deliveredCount > 0) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'DELIVERED' },
    });
  }

  return { messageId: message.id, deliveredCount };
}
```

**Vai trò:** Orchestrate toàn bộ luồng send message: persist → fan-out → update status. Là function phức tạp nhất trong codebase.

---

### Frontend (`frontend/src/`)

---

#### `hooks/useWebSocket.js` — WS connection lifecycle

```js
export function useWebSocket() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('connecting');
  const [lastWsError, setLastWsError] = useState(null);
  const [reconnectedAt, setReconnectedAt] = useState(null);

  const retryCount = useRef(0);
  const disconnectedAt = useRef(null);  // ghi lại thời điểm bị ngắt kết nối

  const connect = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    const ws = new WebSocket(`${VITE_GATEWAY_URL}/ws?token=${token}`);

    ws.onopen = () => {
      retryCount.current = 0;       // reset backoff counter

      // nếu đây là reconnect → báo ChatPage fetch missed messages
      if (disconnectedAt.current !== null) {
        setReconnectedAt(disconnectedAt.current);  // trigger useEffect ở ChatPage
        disconnectedAt.current = null;
      }

      // bắt đầu ping mỗi 30s để giữ connection
      ws.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ping' }));
      }, 30_000);
    };

    ws.onclose = (event) => {
      clearInterval(ws.pingInterval);

      if (event.code === 4001) { setStatus('auth_error'); return; }  // token invalid
      if (event.code === 4003) { setStatus('closed'); return; }      // bị replace
      if (intentionalClose.current) return;                           // user logout

      // ghi thời điểm drop để biết fetch messages từ lúc nào
      if (disconnectedAt.current === null)
        disconnectedAt.current = new Date().toISOString();

      if (event.code === 4002) {
        // token expired → force refresh rồi reconnect ngay
        auth.currentUser?.getIdToken(true).then(() => connect());
        return;
      }

      // gateway restart hoặc lỗi mạng → backoff reconnect
      const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
      retryCount.current++;
      setTimeout(connect, delay);
    };

    ws.onmessage = (event) => {
      const frame = JSON.parse(event.data);
      if (frame.type === 'message' || frame.type === 'system')
        setMessages((prev) => [...prev, frame]);
      else if (frame.type === 'error')
        setLastWsError({ code: frame.code, messageId: frame.messageId, reason: frame.reason });
      // pong: bỏ qua
    };
  }, []);
}
```

**Vai trò:** Quản lý toàn bộ WS connection. Expose ra ngoài: `{ messages, status, sendMessage, reconnectedAt, lastWsError }`. ChatPage không biết gì về WS internals.

---

#### `pages/ChatPage.jsx` — Consume WebSocket + REST

```js
const { messages: realtimeMessages, sendMessage, status, reconnectedAt, lastWsError } = useWebSocket();

// Show WS error frames (DELIVER_FAILED, INTERNAL_ERROR, ...)
useEffect(() => {
  if (!lastWsError) return;
  setError(ERROR_MESSAGES[lastWsError.code] ?? 'Lỗi kết nối.');
}, [lastWsError]);

// Fetch missed messages sau khi WS reconnect
useEffect(() => {
  if (!reconnectedAt || !selectedRoomId) return;
  getMessages(selectedRoomId, { since: reconnectedAt })  // since = thời điểm bị ngắt
    .then(({ messages }) => {
      setHistoryMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        return [...prev, ...messages.filter((m) => !existingIds.has(m.id))];  // dedup
      });
    });
}, [reconnectedAt, selectedRoomId]);

// Merge history + realtime, dedup bằng Set<id>
const allMessages = (() => {
  const seen = new Set();
  return [...historyMessages, ...realtimeForRoom].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
})();
```

**Vai trò:** Orchestrate UI. Combine REST (load history, load more) và WS (realtime). Dedup để tránh message hiện 2 lần khi cả history lẫn realtime đều có cùng messageId.

---

#### `api/chat.api.js` — REST client

```js
export function getMessages(roomId, { before, since, limit } = {}) {
  const params = {};
  if (before) params.before = before;   // cursor pagination (load more cũ hơn)
  if (since)  params.since  = since;    // fetch messages sau thời điểm này (missed)
  if (limit)  params.limit  = limit;
  return api.get(`/chat/rooms/${roomId}/messages`, { params })
    .then((r) => ({ messages: r.data.data, nextCursor: r.data.meta.nextCursor }));
}
```

**Vai trò:** Thin wrapper cho Axios. Param `since` (ISO timestamp) là điểm mới — dùng để fetch missed messages sau reconnect.

---

## Phần 4 — Debug Checkpoints

Khi message gửi nhưng không hiện trên UI, trace theo 6 checkpoint sau (theo thứ tự data flow):

```
[CP1] gateway/ws-handler.js       ws.on('message')          Gateway nhận message từ browser chưa?
[CP2] ws.controller.js            handleMessage()           Backend nhận request từ Gateway chưa?
[CP3] chat.service.js             saveAndBroadcast()        Broadcast đến bao nhiêu members?
[CP4] gateway/deliver.route.js    POST /deliver             Gateway nhận lệnh deliver chưa?
[CP5] useWebSocket.js             ws.onmessage              Browser nhận WS frame chưa?
[CP6] ChatPage.jsx                realtimeForRoom filter    Filter ra được message không?
```

### Cách xem log

**Server (CP1–CP4):**
```bash
docker compose logs -f gateway instance-1 instance-2 instance-3
```

**Frontend (CP5–CP6):** DevTools Console của browser.

### Lưu ý khi debug gateway

Gateway **không có volume mount** — sửa code phải rebuild:
```bash
docker compose up -d --build gateway
```

Backend có volume mount + nodemon → sửa code tự reload, không cần restart.

### Log levels hiện tại

| Checkpoint | File | Level | Nội dung |
|------------|------|-------|----------|
| CP1 | `gateway/ws-handler.js` | `info` | `[ws] connected` khi user kết nối |
| CP2 | `ws.controller.js` | `info` | `[ws] registered` sau khi ghi Redis |
| CP3 | `ws.controller.js` | `info` | `[ws] message broadcast` — kèm `deliveredCount` |
| CP4 | `gateway/deliver.route.js` | `debug` | `[deliver] received` — chỉ hiện khi non-production |
| — | `gateway-client.service.js` | `warn` | Deliver fail sau hết retry |
| — | `ws.controller.js` | `info` | `[ws] deregistered` khi user disconnect |

> `debug` log ở CP4 tự tắt trên production (`NODE_ENV=production`). Dùng `console.log` tạm để debug thì phải xóa sau.

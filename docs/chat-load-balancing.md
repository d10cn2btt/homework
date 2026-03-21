# Chat Load Balancing — System Design

## 1. Vấn đề

Khi scale ngang (chạy nhiều backend instances), WebSocket connection sống trên RAM của từng instance:

```
Browser-A ──WS──► Instance-1   (Instance-1 giữ socket của A)
Browser-B ──WS──► Instance-2   (Instance-2 giữ socket của B)

Khi B gửi message vào room có A:
  Instance-2 muốn push cho A
  → Instance-2 KHÔNG BIẾT A đang ở Instance-1
  → Broadcast thất bại ✗
```

**Yêu cầu cốt lõi:** Instance không được phụ thuộc vào nhau để deliver message.

---

## 2. Lựa chọn giải pháp

### Hướng A — API Gateway làm WS proxy + connId registry ✅ (đã chọn)

Gateway tập trung giữ toàn bộ WS connections. Instance là pure HTTP stateless.

```
Browser ──WS──► Gateway ──HTTP──► Instance (stateless)
Instance ──HTTP POST /deliver──► Gateway ──WS──► Browser
```

**Ưu:**
- Instance hoàn toàn stateless → scale tự do, không lo sticky session
- Deliver targeted: Instance biết đúng Gateway nào (qua `gatewayUrl` trong Redis) → không fan-out thừa
- Tách bạch rõ: Gateway lo transport, Instance lo business logic
- Redis chỉ lưu registry metadata nhẹ, không phải message bus

**Nhược:**
- Nhiều moving parts hơn (Gateway + connId mechanism + callback từ Instance về Gateway)
- Gateway là SPOF nếu chỉ chạy 1 instance (accepted cho giai đoạn này)

### Hướng B — Redis Pub/Sub làm Message Bus (không chọn)

Instance vừa giữ WS, vừa PUBLISH/SUBSCRIBE Redis. Message fan-out tới tất cả instances.

**Không chọn vì:** Fan-out tới tất cả instances dù chỉ 1 instance giữ recipient (lãng phí). Redis trở thành critical path cho message routing. Mục tiêu học muốn tách WS transport layer rõ ràng.

---

## 3. Kiến trúc tổng thể

```
                        ┌─────────────────────────────────────────┐
                        │               Docker Network            │
                        │                                         │
  Browser               │  ┌──────────┐    ┌─────────────────┐   │
  (React + Firebase) ───┼──► Nginx:80 │    │  Gateway:8080   │   │
                        │  │ (LB)     │    │  (WS + HTTP)    │◄──┼── Browser WS
                        │  └────┬─────┘    └────────┬────────┘   │
                        │       │ round-robin         │ /deliver   │
                        │       ▼                    │            │
                        │  ┌──────────────────────┐  │            │
                        │  │    Instance Pool     │  │            │
                        │  │  ┌────┐ ┌────┐ ┌────┐│  │            │
                        │  │  │ I1 │ │ I2 │ │ I3 ││──┘            │
                        │  │  └──┬─┘ └──┬─┘ └──┬─┘│              │
                        │  └─────┼───────┼───────┼──┘              │
                        │        │       │       │                  │
                        │        ▼       ▼       ▼                  │
                        │  ┌───────────────────────┐               │
                        │  │   PostgreSQL + Redis  │               │
                        │  └───────────────────────┘               │
                        └─────────────────────────────────────────┘
```

### Nginx config

```nginx
upstream instance_pool {
    server instance-1:3000;  # round-robin
    server instance-2:3000;
    server instance-3:3000;
}

server {
    listen 80;

    location /internal {
        return 403;  # Block mọi request từ bên ngoài tới /internal
    }

    location / {
        proxy_pass http://instance_pool;
    }
}
```

> **Tại sao block `/internal`?** Internal routes (`/internal/ws/*`) không có auth middleware — chỉ bảo vệ bằng network isolation. Nginx đảm bảo chỉ Gateway (trong Docker network) mới gọi được.

---

## 4. Workflows chi tiết

### 4.1. User connect WS

```
User A      Gateway             Nginx         Instance           Redis
  │              │                 │               │                │
  │──WS open────►│                 │               │                │
  │  ?token=...  │                 │               │                │
  │              │ verifyToken()   │               │                │
  │              │ uid = A         │               │                │
  │              │ connId = uuid() │               │                │
  │              │ registry.set(connId, ws)        │                │
  │              │                 │               │                │
  │              │──POST /internal/ws/connect─────►│                │
  │              │  { userId:A,    │               │                │
  │              │    connId:abc,  │               │                │
  │              │    gatewayUrl:  │               │                │
  │              │    http://gw:8080 }             │                │
  │              │                 │               │──SET───────────►│
  │              │                 │               │  ws:registry:A  │
  │              │                 │               │  [{connId:abc,  │
  │              │                 │               │   gatewayUrl:gw}│
  │              │                 │               │◄────OK──────────│
  │              │◄──200 OK────────────────────────│                │
  │◄──WS ready───│                 │               │                │
```

**Sau connect:**
- Gateway RAM: `{ "abc" → ws_socket_A }`
- Redis: `ws:registry:userA = [{ connId: "abc", gatewayUrl: "http://gateway:8080" }]`

Gateway còn set `setTimeout(() => ws.close(4002), tokenExp - now - 60s)` để proactively đóng trước khi token hết hạn.

---

### 4.2. User gửi message vào room

```
User A      Gateway             Nginx         Instance           Redis         User B
  │              │                 │               │                │              │
  │──WS frame───►│                 │               │                │              │
  │  { type: "message",           │               │                │              │
  │    roomId: "r1",              │               │                │              │
  │    content: "hello" }         │               │                │              │
  │              │                 │               │                │              │
  │   [ping?] ───► ws.send(pong)  │               │                │  ← handled   │
  │   [message] →                 │               │                │    at Gateway │
  │              │──POST /internal/ws/message─────►│                │              │
  │              │  { from:A, roomId:r1,           │                │              │
  │              │    content:"hello" }            │                │              │
  │              │                 │               │                │              │
  │              │                 │               │──INSERT DB─────────────────── │
  │              │                 │               │  Message(SENT) │              │
  │              │                 │               │                │              │
  │              │                 │               │──getRoomMembers(r1)────────── │
  │              │                 │               │  → [A, B]      │              │
  │              │                 │               │                │              │
  │              │                 │               │  for each member:             │
  │              │                 │               │──GET ws:registry:A───────────►│
  │              │                 │               │◄──[{connId:abc,gw}]───────────│
  │              │                 │               │──GET ws:registry:B───────────►│
  │              │                 │               │◄──[{connId:xyz,gw}]───────────│
  │              │                 │               │                │              │
  │              │◄──POST /deliver─────────────────│                │              │
  │              │  {connId:abc, payload}          │                │              │
  │◄──WS push────│  (message to A) │               │                │              │
  │              │                 │               │                │              │
  │              │◄──POST /deliver─────────────────│                │              │
  │              │  {connId:xyz, payload}          │                │              │
  │              │──WS push─────────────────────────────────────────────────────►│
  │              │                 │               │                │              │
  │              │                 │               │──UPDATE DB─────────────────── │
  │              │                 │               │  Message(DELIVERED)           │
  │              │                 │               │                │              │
  │              │                 │               │──200 OK────────│              │
  │              │◄──200 OK────────│               │                │              │
```

**Logic `saveAndBroadcast()`:**
1. `prisma.message.create()` → persist, `status: SENT`
2. `getRoomMembers(roomId)` → lấy tất cả userIds trong room
3. Với mỗi member: `wsRegistry.lookup(userId)` → Redis → `[{connId, gatewayUrl}]`
4. Với mỗi `{connId, gatewayUrl}`: `deliver(gatewayUrl, connId, payload)` → `POST {gw}/deliver`
5. Nếu `deliveredCount > 0` → `prisma.message.update(status: DELIVERED)`

---

### 4.3. User đóng WS

```
User A      Gateway             Nginx         Instance           Redis
  │              │                 │               │                │
  │──close WS───►│                 │               │                │
  │              │ registry.delete(connId)         │                │
  │              │──POST /internal/ws/disconnect──►│                │
  │              │  { userId:A, connId:abc }       │                │
  │              │                 │               │──DEL entry─────►│
  │              │                 │               │  filter connId: abc out       │
  │              │                 │               │  array empty → DEL key        │
  │              │                 │               │◄────OK──────────│
  │              │◄──200 OK────────────────────────│                │
```

---

### 4.4. Ping / Keepalive

```
Browser ──{ type: "ping" }──► Gateway
Gateway ──{ type: "pong" }──► Browser   (không forward lên Instance)
```

Interval: mỗi 30s. Gateway xử lý tại chỗ để tránh Instance crash khi nhận ping với `roomId: undefined`.

---

### 4.5. Token expired trong session

```
[Tại thời điểm connect]
Gateway: msUntilExpiry = token.exp * 1000 - Date.now() - 60_000
         setTimeout(() => ws.close(4002), msUntilExpiry)

[60 giây trước khi token hết hạn]
Gateway ──ws.close(4002)──► Browser
Browser: nhận onclose.code === 4002
         → auth.currentUser.getIdToken(true)  ← force refresh Firebase token
         → reconnect với token mới
```

User không cảm nhận gián đoạn (quá trình diễn ra trong vài giây, FE tự reconnect).

---

### 4.6. WS reconnect — Fetch missed messages

```
[WS bị drop — mạng mất, Gateway restart, token refresh...]
FE: disconnectedAt = new Date().toISOString()
    exponential backoff reconnect (1s → 2s → 4s → ... → 30s cap)

[Reconnect thành công]
FE: reconnectedAt = disconnectedAt (cũ)
    GET /api/chat/rooms/:roomId/messages?since=reconnectedAt
    → lấy tất cả messages trong khoảng thời gian offline
    → merge vào historyMessages (dedup bằng Set<id>)
```

---

## 5. Error Handling & Edge Cases

### 5.1. Recipient offline

**Scenario:** B đóng tab lúc 10:00. A gửi message lúc 10:05.

```
Instance: wsRegistry.lookup(userB) → []   (key đã bị DEL khi B disconnect)
          skip deliver, deliveredCount không tăng
          message giữ status: SENT
          trả { ok: true, data: { deliveredCount: 0 } }
```

Khi B online trở lại: FE reconnect → fetch `?since=disconnectedAt` → nhận đủ messages.

---

### 5.2. CONN_NOT_FOUND (stale Redis entry)

**Scenario:** Gateway restart đột ngột (SIGKILL), in-memory registry mất. Redis còn entry cũ.

```
Instance: wsRegistry.lookup(userA) → [{ connId: "abc", gatewayUrl: "http://gw:8080" }]
          POST http://gw:8080/deliver { connId: "abc", ... }
          Gateway: registry.has("abc") → false   (đã mất sau restart)
          → 404 { error: "CONN_NOT_FOUND" }

gateway-client.service.js nhận 404:
  → deregister(userId, "abc")   ← xóa stale entry khỏi Redis ngay
  → return { success: false }   ← không retry (404 là permanent)
  → deliveredCount không tăng
```

Message vẫn persist DB với `status: SENT`. User fetch khi reconnect.

---

### 5.3. Deliver fail — network error nội bộ

**Scenario:** POST `/deliver` timeout do spike latency Docker network.

```
gateway-client.service.js retry logic:
  lần 1: POST /deliver → timeout → chờ 100ms
  lần 2: POST /deliver → timeout → chờ 300ms
  lần 3: POST /deliver → timeout → hết retry
  → logger.warn(...)
  → return { success: false }   ← không throw, không crash broadcast
```

Delays: `[100ms, 300ms, 1000ms]`. Sau 3 lần thất bại → message giữ `status: SENT`.

---

### 5.4. Multi-device (nhiều tab / thiết bị)

**Scenario:** User A login trên laptop (connId: `abc`) và điện thoại (connId: `def`) cùng lúc.

```
Redis: ws:registry:userA = [
  { connId: "abc", gatewayUrl: "http://gw:8080" },   ← laptop
  { connId: "def", gatewayUrl: "http://gw:8080" },   ← điện thoại
]

Instance.saveAndBroadcast():
  for entry in lookup(userA):
    deliver(gw, "abc", payload) → success: true   ← laptop nhận
    deliver(gw, "def", payload) → success: true   ← điện thoại nhận
  deliveredCount = 2
  → UPDATE Message status: DELIVERED
```

Nếu 1 connId CONN_NOT_FOUND → deregister entry đó, tiếp tục deliver entries còn lại.

---

### 5.5. Deliver route — ws.send() throw

**Scenario:** WS đang ở trạng thái `CLOSING` khi Instance gọi `/deliver`.

```javascript
// deliver.route.js
try {
  ws.send(JSON.stringify(payload));
} catch {
  registry.delete(connId);          // cleanup RAM
  return res.status(404).json({ error: 'CONN_NOT_FOUND' });
}
```

Instance nhận 404 → deregister Redis → không crash Gateway.

---

## 6. FE Connection Lifecycle

```
[Initial mount]
connect()
  → getIdToken()
  → new WebSocket(VITE_GATEWAY_URL + "/ws?token=...")

[onopen]
  retryCount = 0
  if reconnectedAt (trước đó đã disconnect):
    setReconnectedAt(disconnectedAt)  → trigger fetch missed messages
  start ping interval (30s)

[onclose]
  clearInterval(ping)
  code === 4001 → setStatus("auth_error"), STOP
  code === 4003 → STOP  (tab này bị replace)
  code === 4002 → getIdToken(force=true) → reconnect ngay
  intentionalClose → STOP
  else → disconnectedAt = now, setTimeout(connect, backoff(retryCount++))

[onmessage]
  frame.type === "message" | "system" → setMessages
  frame.type === "error"              → setLastWsError → ChatPage show toast
  frame.type === "pong"              → ignore

[Exponential backoff]
  delay = min(1000 * 2^retryCount, 30_000)
  retryCount 0→1s, 1→2s, 2→4s, 3→8s, 4→16s, 5+→30s
```

---

## 7. Redis Schema

```
Key:   ws:registry:{userId}
Type:  String (JSON)
Value: [{ connId: string, gatewayUrl: string }, ...]
TTL:   7200s (2 giờ)
```

**Lifecycle:**
- `register(userId, connId, gatewayUrl)` — append vào array, refresh TTL
- `deregister(userId, connId)` — filter bỏ connId; nếu array rỗng → `DEL` key
- `lookup(userId)` → `[]` nếu key không tồn tại (user offline)

**TTL 2h** đóng vai trò safety net: nếu Gateway crash mà không cleanup được `/disconnect`, entry tự expire sau 2h thay vì tồn tại mãi.

---

## 8. Message Status

```
INSERT → status: SENT
  ↓ (nếu deliveredCount > 0)
UPDATE → status: DELIVERED
```

| Status | Ý nghĩa |
|---|---|
| `SENT` | Persist DB thành công, chưa deliver realtime được cho ai |
| `DELIVERED` | Ít nhất 1 member trong room đã nhận qua WS |

FE dùng `status` để hiển thị delivery indicator. Recipient offline vẫn nhận được message qua REST `?since=` khi reconnect.

---

## 9. Protocol WS

### Close codes

| Code | Trigger | FE xử lý |
|---|---|---|
| `1000` | User logout / đóng tab bình thường | Không reconnect |
| `1001` | Gateway graceful shutdown (SIGTERM) | Reconnect với exponential backoff |
| `4001` | Token invalid tại handshake | Redirect `/login`, không reconnect |
| `4002` | Token sắp hết hạn (60s trước exp) | `getIdToken(force=true)` → reconnect |
| `4003` | Duplicate connection (cùng uid) | Không reconnect (tab cũ bị replace) |

### Error frames (mid-session, connection vẫn sống)

```json
{ "type": "error", "code": "DELIVER_FAILED", "messageId": "...", "reason": "recipient_offline" }
{ "type": "error", "code": "INVALID_PAYLOAD", "reason": "missing field: roomId" }
{ "type": "error", "code": "INTERNAL_ERROR", "messageId": "..." }
```

### Client frames

```json
{ "type": "message", "roomId": "...", "content": "..." }
{ "type": "ping" }
```

### Server frames

```json
{ "type": "message", "data": { "id": "...", "roomId": "...", "senderId": "...", ... } }
{ "type": "system",  "data": { ... } }
{ "type": "pong" }
{ "type": "error",   "code": "...", ... }
```

---

## 10. Security Model

| Layer | Cơ chế |
|---|---|
| FE → Gateway (WS) | Firebase ID Token trong query string; verify bằng Firebase Admin SDK |
| Gateway → Instance | Nginx block `/internal` với request từ bên ngoài (`return 403`) |
| Instance → Gateway (`/deliver`) | Gọi trực tiếp qua Docker network (không qua Nginx), không cần auth |
| Token refresh | Gateway set timer proactively close 60s trước `exp` |

---

## 11. Risks & Mitigations

### Gateway là SPOF

- **Vấn đề:** Crash đột ngột → toàn bộ WS connections đứt, không có failover tự động
- **Mitigation hiện tại:**
  - FE reconnect với exponential backoff → tự reconnect khi Gateway restart xong
  - TTL 2h trên Redis tự cleanup stale entries nếu crash không cleanup được
  - Graceful shutdown: `process.on('SIGTERM')` → close tất cả connections → `/disconnect`
- **TODO khi scale:** Gateway LB + multiple Gateway instances, `gatewayUrl` trong Redis lúc đó mới thực sự có ý nghĩa

### Redis là critical path cho routing

- **Vấn đề:** Redis down → `lookup()` fail → deliver ngưng dù Gateway và Instance vẫn sống
- **Mitigation hiện tại:** Deliver fail không throw → message giữ `status: SENT` → recipient fetch khi reconnect
- **TODO:** Circuit breaker tại Instance; Redis Sentinel (1 primary + 2 replica) cho HA

---

## 12. Cấu trúc thư mục (phần mới)

```
gateway/
├── index.js               # Boot: HTTP + WS server
├── ws-handler.js          # WS lifecycle: auth → connId → forward
├── ws-auth.js             # verifyToken() via Firebase Admin
├── conn-registry.js       # in-memory Map: connId → ws
├── deliver.route.js       # POST /deliver ← Instance gọi vào
├── ws-protocol.js         # Constants: close codes, error codes, message types
├── Dockerfile
└── package.json

backend/src/
├── services/
│   ├── ws-registry.service.js      # Redis CRUD: ws:registry:{userId}
│   └── gateway-client.service.js   # POST /deliver với retry 3 lần
├── controllers/internal/
│   └── ws.controller.js            # handleConnect, handleMessage, handleDisconnect
└── routes/internal/
    └── ws.route.js                 # POST /connect, /message, /disconnect

nginx/
└── nginx.conf             # upstream instance_pool + block /internal
```

---

> **Xem thêm:**
> - [`gateway/FLOW.md`](../gateway/FLOW.md) — flow diagrams chi tiết từng bước tại Gateway
> - [`docs/api_contract.md`](api_contract.md) — request/response shape đầy đủ cho tất cả endpoints
> - [`specs/chat-load-balancing/design.md`](../specs/chat-load-balancing/design.md) — brainstorm, so sánh Hướng A vs B, edge cases

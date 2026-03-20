# Design: Chat Load Balancing

## Vấn đề

Khi scale ngang (nhiều instances), WebSocket connection sống trên RAM của từng instance.
User A ở Instance 1, User B ở Instance 2 → message không đến được nhau.

Giải pháp chung: **không để routing logic phụ thuộc vào instance nào đang xử lý.**

---

## Options

### Hướng A: API Gateway làm WS proxy + connId registry

> **Khái niệm cốt lõi:**
> - Gateway giữ WS connection, sinh ra `connId` cho mỗi connection
> - Gateway dịch WS event → HTTP call xuống Instance, kèm `connId` và `gatewayId`
> - Instance lưu vào Redis: `userId → { gatewayId, connId }`
> - Instance xử lý xong → lookup Redis → gọi HTTP thẳng vào đúng Gateway instance kèm `connId`
> - Gateway nhận HTTP → tìm `connId` trong local registry → forward qua WS tới đúng user
> - **Gateway instances hoàn toàn độc lập, không cần biết nhau**

- **Ưu:**
  - Instance hoàn toàn stateless HTTP — scale tự do, không giữ WS connection
  - Gateway scale được vì Instance biết gọi đúng Gateway nào (qua `gatewayId` lưu trong Redis)
  - Redis chỉ lưu registry metadata nhẹ, không phải message bus
  - Deliver targeted — không fan-out thừa
  - Tách bạch rõ: Gateway lo transport, Instance lo business logic
- **Nhược:**
  - Nhiều moving parts hơn: Gateway + connId mechanism + Instance → Gateway callback
  - Node.js không phát huy thế mạnh ở tầng Instance (chỉ xử lý HTTP thuần, không giữ connection)
  - Instance cần biết địa chỉ Gateway để gọi ngược lại → cần service discovery hoặc config tĩnh
- **Phù hợp khi:** Cần tách WS layer và business logic hoàn toàn độc lập, scale 2 tầng riêng biệt

**System Design:**
```
  User A / User B
       │  ▲
       │  │ WS
       ▼  │
  ┌──────────────┐
  │   Gateway    │◄─────────────────────┐
  └──────┬───────┘                      │ HTTP (deliver)
         │ HTTP                         │
         │ (on event: connect /         │
         │  send / disconnect / error)  │
         ▼                              │
  ┌──────────────┐                      │
  │      LB      │                      │
  └──┬───────┬───┘                      │
     │       │                          │
     ▼       ▼                          │
  ┌──────┐ ┌──────┐                     │
  │ Ins1 │─┤      ├─────────────────────┘
  └──┬───┘ │ Ins2 │
     └──┬──┘───┬──┘
        └───┬──┘
            │  read / write
            ▼
  ┌──────────────┐
  │    Redis     │
  │  (registry)  │
  └──────────────┘
```

**Data Flow:**
```
  User A     Gateway-1       LB         Instance        Redis        Gateway-2    User B
    │             │           │              │              │              │           │
    │──WS open───►│           │              │              │              │◄──WS open─│
    │             │─connect──►│              │              │              │           │
    │             │ (connId=abc,gw=gw1)      │              │              │           │
    │             │           │──route──────►│              │              │           │
    │             │           │              │──register───►│ userA:{gw1,abc}          │
    │             │           │              │◄─────────────┤              │           │
    │             │           │              │──register───►│ userB:{gw2,xyz}          │
    │             │           │              │              │              │           │
    │──"hello"───►│           │              │              │              │           │
    │             │─POST msg─►│              │              │              │           │
    │             │           │──route──────►│              │              │           │
    │             │           │              │──lookup B───►│              │           │
    │             │           │              │◄──{gw2,xyz}──│              │           │
    │             │           │              │──POST deliver(connId=xyz)──►│           │
    │             │           │              │              │              │──"hello"──►│
```

**Step-by-step:**
```
[Connect]
1. User A mở WS → Gateway-1
2. Gateway-1 sinh connId=abc, gọi HTTP POST /connect { userId:A, connId:abc, gatewayId:gw1 } → LB → Instance
3. Instance lưu Redis: { userA: { gatewayId:gw1, connId:abc } }
4. Gateway-1 giữ WS của A, map local: { abc → ws_socket_A }

[Send message - A gửi cho B]
1. A gửi "hello" qua WS → Gateway-1
2. Gateway-1 dịch → HTTP POST /message { from:A, to:B, text:"hello" } → LB → Instance
3. Instance lưu DB, lookup Redis: userB → { gatewayId:gw2, connId:xyz }
4. Instance gọi HTTP thẳng → Gateway-2: POST /deliver { connId:xyz, text:"hello" }
5. Gateway-2 tìm connId=xyz trong local map → forward "hello" qua WS tới User B
```

---

### Hướng B: Redis Pub/Sub làm Message Bus

> **Khái niệm cốt lõi:**
> - Mỗi Instance vừa giữ WS connection, vừa subscribe Redis channel
> - Instance nhận message từ client → PUBLISH lên Redis
> - Redis fan-out tới tất cả instances → instance nào giữ recipient thì deliver
> - Instance không cần biết nhau, chỉ cần biết Redis

- **Ưu:**
  - Standard pattern, battle-tested — Redis Sentinel/Cluster cho HA
  - Instance thực sự độc lập — 1 instance chết, client reconnect sang instance khác là xong
  - Tận dụng đúng thế mạnh Node.js: event loop giữ nhiều WS connection + non-blocking I/O
  - Ít moving parts nhất trong 2 hướng
- **Nhược:**
  - Redis trở thành critical path cho message routing, không chỉ là cache nữa
  - Fan-out tới tất cả instances dù chỉ 1 instance giữ recipient — lãng phí khi nhiều instances
  - Redis chết → không route được message (dù WS connection vẫn còn sống)
- **Phù hợp khi:** Scale vừa, muốn đơn giản, Redis đã có sẵn trong stack

**System Design:**
```
  User A                         User B
    │  (WS)                         │  (WS)
    └──────────────┬────────────────┘
                   │
            ┌──────▼──────┐
            │     LB      │
            └──┬───────┬──┘
               │       │
               ▼       ▼
        ┌──────────┐ ┌──────────┐
        │Instance 1│ │Instance 2│
        │(Express) │ │(Express) │
        │giữ WS: A │ │giữ WS: B │
        └─────┬────┘ └────┬─────┘
              │  Pub/Sub  │
              └─────┬─────┘
                    │
             ┌──────▼──────┐
             │    Redis    │
             │  (Pub/Sub)  │
             └─────────────┘
```

**Data Flow:**
```
  User A      Instance 1          Redis           Instance 2      User B
    │               │           (Pub/Sub)              │              │
    │──WS open─────►│               │                  │◄──WS open────│
    │               │──SUBSCRIBE───►│◄──SUBSCRIBE───────│              │
    │               │               │                  │              │
    │──"hello"─────►│               │                  │              │
    │               │──PUBLISH─────►│                  │              │
    │               │               │──fan-out─────────►│              │
    │               │◄──fan-out─────│  (skip: sender)   │──"hello"────►│
```

**Step-by-step:**
```
[Connect]
1. User A mở WS → LB → Instance 1
2. Instance 1 lưu local registry: { userA: ws_socket }
3. Instance 1 SUBSCRIBE Redis channel (vd: chat:room:1)

[Send message - A gửi cho B]
1. A gửi "hello" → Instance 1 (đang giữ WS của A)
2. Instance 1 PUBLISH lên Redis: { from:A, to:B, text:"hello" }
3. Redis fan-out tới tất cả instances đang SUBSCRIBE
4. Instance 1 nhận → bỏ qua (A là sender)
5. Instance 2 nhận → tìm B trong local registry → deliver "hello" qua WS
```

---

## So sánh

| | Hướng A (Gateway + connId) | Hướng B (Redis Pub/Sub) |
|---|---|---|
| WS sống ở đâu | Gateway | Instance |
| Instance | Stateless HTTP hoàn toàn | Giữ WS + xử lý logic |
| Node.js strength | Chỉ phát huy ở Gateway | Phát huy đầy đủ ở Instance |
| Redis role | Registry nhẹ | Message bus critical path |
| Deliver | Targeted (gọi đúng GW) | Fan-out tất cả instances |
| Moving parts | Nhiều hơn | Ít hơn |
| Scale Gateway | Được (nhờ connId trong Redis) | N/A |
| Khi Redis chết | Mất routing, WS còn | Mất routing, WS còn |
| Khi 1 node chết | Gateway chết → user mất WS | Instance chết → client reconnect |

## Đề xuất

> **Đã chọn: Hướng A** — xem System Design bên dưới.

Ban đầu Hướng B được đề xuất vì ít moving parts hơn. Tuy nhiên sau khi cân nhắc, chọn Hướng A vì mục tiêu học cách tách WS transport layer ra khỏi business logic — hiểu rõ từng tầng hơn, và Instance stateless HTTP giúp scale tự do hơn.

---

## System Design

**Hướng được chọn: Hướng A — API Gateway làm WS proxy + connId registry**

**Tech stack quyết định:**
- **Gateway**: Node.js + `ws` package — cùng runtime với Instance, event loop phù hợp giữ nhiều WS connection
- **LB**: Nginx — round-robin upstream cho Instance pool, đứng giữa Gateway và Instance
- **Gateway instances**: 1 instance duy nhất (SPOF accepted), scale sau khi cần
- **Topology**: `Client ──WS──► Gateway ──HTTP──► Nginx ──► Instance-1 / Instance-2 / Instance-3`

### User flow

3 flows chính: Connect, Send message, Disconnect. Chỉ có 1 Gateway duy nhất.

**[Connect] — User A kết nối**
```
User A      Gateway       Nginx      Instance       Redis
  |            |            |            |             |
  |──WS open──►|            |            |             |
  |            |──POST /internal/ws/connect──►|        |
  |            |  {userId:A, connId:abc, |   |         |
  |            |   gatewayUrl:           |   |         |
  |            |   http://gateway:8080}  |   |         |
  |            |            |            |──SET ws:registry:userA──►|
  |            |            |            |◄─────────────────────────|
  |◄──WS ready─|            |            |             |
```

**[Send message] — A gửi "hello" cho B (B đã connect sẵn)**
```
User A      Gateway       Nginx      Instance       Redis      User B
  |            |            |            |             |           |
  |──"hello"──►|            |            |             |           |
  |            |──POST /internal/ws/message──►|        |           |
  |            |  {from:A, to:B,         |   |         |           |
  |            |   text:"hello"}         |   |         |           |
  |            |            |            |──INSERT DB  |           |
  |            |            |            |──GET ws:registry:userB─►|
  |            |            |            |◄──[{connId:xyz,...}]────|
  |            |◄──POST /deliver─────────|             |           |
  |            |  {connId:xyz, payload}  |             |           |
  |            |──ws.send("hello")──────────────────────────────────►|
  |            |──200 OK────►            |             |           |
```

**[Disconnect] — User A đóng tab**
```
User A      Gateway       Nginx      Instance       Redis
  |            |            |            |             |
  |──close WS─►|            |            |             |
  |            |──POST /internal/ws/disconnect──►|     |
  |            |  {userId:A, connId:abc} |   |         |
  |            |            |            |──DEL entry ws:registry:userA─►|
  |            |            |            |◄──────────────────────────────|
  |            |◄──200 OK───|            |             |
```

### Data flow

```
[Connect]
User ──WS──► Gateway (giữ ws_socket, sinh connId)
           ──HTTP POST /internal/ws/connect──► LB ──► Instance
                                                        ──SET Redis: userId → [{connId, gatewayId, gatewayUrl}]

[Send message]
User ──WS──► Gateway
           ──HTTP POST /internal/ws/message──► LB ──► Instance
                                                        ──INSERT DB (message persist)
                                                        ──GET Redis: recipient → [{connId, gatewayUrl}]
                                                        ──HTTP POST gatewayUrl/deliver──► Gateway
                                                                                           ──ws_socket.send()──► User

[Disconnect]
User ──WS close──► Gateway
                ──HTTP POST /internal/ws/disconnect──► LB ──► Instance
                                                               ──DEL Redis entry cho connId đó
```

### DB changes

Routing metadata (connId, gatewayId) sống hoàn toàn trong Redis — không cần thêm table mới.
Chỉ cần đảm bảo Message table có field `status` để track delivered/undelivered.

| Table   | Field     | Kiểu                              | Lý do                                            |
|---------|-----------|-----------------------------------|--------------------------------------------------|
| Message | status    | ENUM('sent', 'delivered', 'read') | Track trạng thái khi recipient offline hoặc deliver fail |

> Nếu Message table chưa có: tạo mới với full schema (id, fromUserId, toUserId, text, status, createdAt).

### API changes

**Internal endpoints — Gateway gọi Instance (qua LB):**

> Prefix `/internal` để phân biệt với public API. Nên block prefix này ở Nginx, không expose ra ngoài.

```
POST /internal/ws/connect
Body: { userId: string, connId: string, gatewayUrl: string }
Response: { success: true }

POST /internal/ws/message
Body: { from: string, to: string, text: string, connId: string }
Response: { success: true, data: { messageId: string, delivered: boolean } }

POST /internal/ws/disconnect
Body: { userId: string, connId: string }
Response: { success: true }
```

**Deliver endpoint — Instance gọi thẳng Gateway (không qua LB):**

```
POST /deliver
Body: {
  connId: string,
  payload: {
    type: "message",
    data: { messageId: string, from: string, text: string, createdAt: string }
  }
}
Response: { success: true } | { success: false, error: "CONN_NOT_FOUND" }
```

**Endpoint bổ sung — FE gọi khi reconnect để lấy tin nhắn bỏ lỡ:**

```
GET /api/v1/messages?since=<ISO_timestamp>&with=<userId>
Response: { success: true, data: [{ messageId, from, to, text, status, createdAt }] }
```

> Endpoint này đã thuộc phạm vi feature chat cơ bản. Liệt kê ở đây vì edge case "Recipient offline" phụ thuộc vào nó.

**Redis schema:**
```
Key:   ws:registry:{userId}
Value: JSON array — [{ connId, gatewayUrl }]   // array để hỗ trợ multi-device
TTL:   2 giờ (refresh mỗi khi có activity)
```

### WS error protocol

WS có 2 cơ chế báo lỗi khác nhau — cần dùng đúng loại:

- **Close code**: Khi connection **không thể hoặc không nên tiếp tục** → Gateway đóng WS và đính kèm code. FE nhận qua `onclose.code`. Giống HTTP status code nhưng cho việc kết thúc connection.
- **Error message payload**: Khi lỗi xảy ra **mid-session nhưng connection vẫn nên tiếp tục** → Gateway/Instance gửi JSON qua WS như message bình thường. Connection không bị đóng. FE nhận qua `onmessage`.

**Close codes:**

| Code | Khi nào xảy ra | FE xử lý |
|------|----------------|----------|
| 1000 | User logout hoặc đóng tab bình thường — client chủ động gọi `ws.close()` | Không reconnect |
| 1001 | Gateway đang graceful shutdown (deploy version mới) — Gateway close tất cả connections trước khi tắt | Reconnect với exponential backoff; Gateway sẽ restart sau vài giây |
| 4001 | Token invalid khi handshake — Gateway verify token lúc WS connect, fail ngay từ đầu | Redirect về trang login, không reconnect |
| 4002 | Session timeout — Gateway set timer từ JWT `exp`, chủ động close 60s trước khi token hết hạn | Firebase SDK refresh token → reconnect với token mới (silent, user không hay) |
| 4003 | Duplicate connection — user mở tab/device mới với cùng userId, Gateway close connection cũ | Không reconnect (tab cũ đã được thay thế) |

**Error message payload:**

```json
// Recipient offline — message đã lưu DB, sẽ deliver khi B online
{ "type": "error", "code": "DELIVER_FAILED", "messageId": "...", "reason": "recipient_offline" }

// Message gửi lên thiếu field bắt buộc
{ "type": "error", "code": "INVALID_PAYLOAD", "reason": "missing field: to" }

// Gateway không reach được Instance (Nginx/Instance down)
{ "type": "error", "code": "INTERNAL_ERROR", "messageId": "..." }
```

### Edge cases

- **Gateway redeploy / graceful restart**
  - Tình huống: Deploy version mới, Gateway process nhận SIGTERM và shutdown. Lúc này vẫn còn 50 WS connections đang mở. Nếu exit hook chạy kịp → dọn Redis sạch. Nếu bị force kill (SIGKILL) → Gateway chết ngay, in-memory conn registry mất, nhưng Redis vẫn còn các connId cũ trỏ về gateway này.
  - Nguyên nhân: in-memory registry (connId → ws_socket) không persist — mỗi lần Gateway restart là mất sạch, trong khi Redis entry có TTL 2h nên còn sống.
  - Xử lý: Instance gọi POST /deliver với connId cũ → Gateway không tìm thấy trong registry → trả `{ error: "CONN_NOT_FOUND" }` → Instance nhận response này, xóa luôn entry đó khỏi Redis, trả `delivered: false` cho sender. Message vẫn persist DB, recipient lấy về khi reconnect qua `GET /api/v1/messages?since=...`.

- **Recipient offline**
  - Tình huống: User B đóng tab lúc 10:00. User A gửi message cho B lúc 10:05.
  - Nguyên nhân: Lúc B đóng tab, WS close → Gateway gọi /internal/ws/disconnect → Instance xóa entry Redis của B. Đến khi A gửi, Instance lookup Redis → không có key `ws:registry:userB` → không biết deliver đi đâu.
  - Xử lý: Không crash, không báo lỗi real-time. Message INSERT DB với `status: 'sent'`. Khi B mở app lại, FE gọi `GET /api/v1/messages?since=<lastSeen>` → lấy về tất cả tin nhắn bỏ lỡ.

- **Multi-device (user mở nhiều tab / thiết bị)**
  - Tình huống: User A login trên laptop (→ Gateway, connId=`abc`) và điện thoại (→ Gateway, connId=`def`) cùng lúc. User B gửi message cho A.
  - Nguyên nhân: Nếu Redis chỉ lưu 1 entry `userA → {connId: def}` (ghi đè), thì laptop không nhận được message dù vẫn đang connect.
  - Xử lý: Redis lưu array `[{connId: abc, ...}, {connId: def, ...}]`. Instance iterate và deliver tới cả 2 connId. Nếu 1 fail (CONN_NOT_FOUND) → xóa entry đó, tiếp tục deliver cho entries còn lại.

- **Firebase token hết hạn trong session**
  - Tình huống: User connect WS lúc 9:00 với token hết hạn lúc 10:00. Đến 10:00, user vẫn đang chat bình thường — WS connection vẫn sống — nhưng token đã invalid.
  - Nguyên nhân: Gateway chỉ verify token 1 lần lúc handshake, không re-verify giữa chừng. Token hết hạn không tự động đóng connection.
  - Xử lý: Khi Gateway nhận WS connect, decode JWT (base64, không cần verify signature) lấy field `exp` → set `setTimeout(() => ws.close(4002), exp * 1000 - Date.now() - 60_000)`. FE nhận close code `4002` → gọi Firebase refresh token → reconnect với token mới. User không cảm nhận gián đoạn.

- **Deliver fail do mạng nội bộ chập chờn**
  - Tình huống: Instance gọi `POST http://gateway:8080/deliver` → gateway đang alive nhưng mạng docker nội bộ spike latency 3s → request timeout.
  - Nguyên nhân: Mạng nội bộ docker/K8s không đảm bảo 100% — transient error vẫn xảy ra dù 2 service cùng host.
  - Xử lý: Instance retry tối đa 3 lần với exponential backoff (100ms → 300ms → 1s). Mỗi lần retry dùng cùng `messageId` để Gateway idempotent. Sau 3 lần fail → mark message `status: 'sent'`, log warn, trả response bình thường cho Gateway (không throw lỗi về phía sender).

### Risks

- **Gateway là SPOF (accepted)**
  - Vấn đề: Gateway crash đột ngột → toàn bộ WS connections đứt, không ai gửi/nhận được real-time message cho đến khi Gateway restart xong. Không có failover tự động.
  - Nguyên nhân: Thiết kế hiện tại chỉ có 1 Gateway instance vì đây là giai đoạn đầu — chưa cần scale.
  - Mitigation (accepted): (1) Graceful shutdown: Gateway đăng ký `process.on('SIGTERM')` → gọi `/internal/ws/disconnect` cho tất cả connection trước khi tắt, dọn Redis sạch. (2) TTL 2h trên Redis tự dọn stale entry nếu crash đột ngột. (3) FE reconnect với exponential backoff — khi Gateway restart xong, user tự reconnect về cùng URL. Scale multi-gateway thì revisit sau.
  - **TODO**: Khi traffic tăng, cần bổ sung Gateway LB (Nginx) + multiple Gateway instances + shared conn registry (hoặc sticky routing). Lúc đó `gatewayUrl` trong Redis mới thực sự cần thiết.

- **Redis là critical path cho routing**
  - Vấn đề: Redis unavailable → Instance không lookup được `ws:registry:{userId}` → toàn bộ real-time delivery ngưng dù Gateway và Instance vẫn sống. Message bị stuck ở Instance, không đến được người nhận.
  - Nguyên nhân: Registry userId→connId chỉ sống trong Redis, không có fallback store nào khác. Đây là trade-off đã chọn — đổi lấy stateless Instance.
  - Mitigation: Circuit breaker tại Instance: nếu Redis không respond sau N ms → fail nhanh, không retry vô hạn, trả `{ delivered: false }`, message vẫn lưu DB với `status: 'sent'`. Không cascade crash. Về infra: chạy Redis Sentinel (1 primary + 2 replica) để tự động failover khi primary chết, downtime tính bằng giây.

### Files cần thay đổi

| File                                        | Loại thay đổi | Ghi chú                                                    |
|---------------------------------------------|---------------|------------------------------------------------------------|
| `gateway/index.js`                          | Tạo mới       | Gateway process: WS server + HTTP server (/deliver)        |
| `gateway/ws-handler.js`                     | Tạo mới       | Dịch WS events → HTTP POST tới Instance                   |
| `gateway/conn-registry.js`                  | Tạo mới       | In-memory Map: `connId → ws_socket`                        |
| `gateway/deliver.route.js`                  | Tạo mới       | POST /deliver — nhận từ Instance, forward qua WS           |
| `src/routes/internal/ws.route.js`           | Tạo mới       | /internal/ws/connect, /message, /disconnect                |
| `src/controllers/internal/ws.controller.js` | Tạo mới       | Validate + gọi service                                     |
| `src/services/ws-registry.service.js`       | Tạo mới       | Redis read/write: userId ↔ [{connId, gatewayId, gatewayUrl}] |
| `src/services/gateway-client.service.js`    | Tạo mới       | HTTP client gọi POST /deliver trên Gateway                 |
| `src/services/message.service.js`           | Sửa           | Tích hợp ws-registry lookup + gateway-client khi gửi msg  |
| `prisma/schema.prisma`                      | Sửa           | Thêm Message model (nếu chưa có) + field `status`         |
| `docker-compose.yml`                        | Sửa           | Thêm `gateway` service, expose port riêng                  |
| `nginx/nginx.conf`                          | Tạo mới       | Upstream block cho Instance pool, health check `/health`   |
| **Frontend**                                |               |                                                            |
| `src/services/websocket.service.js`         | Sửa           | Đổi WS URL → gateway host; thêm reconnect với exp backoff  |
| `src/hooks/useChat.js` (hoặc tương đương)   | Sửa           | Handle `onclose` code 4001/4002/1001; handle `type:error` payload |
| `src/config/env.js`                         | Sửa           | Thêm `VITE_GATEWAY_URL` thay cho `VITE_WS_URL` cũ         |

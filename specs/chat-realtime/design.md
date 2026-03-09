# Design: Chat Realtime

## Options

### Hướng A: WebSocket (Socket.io) + PostgreSQL
Mô tả: Dùng Socket.io trên Express server hiện tại, lưu messages vào PostgreSQL, broadcast qua socket rooms.
- Ưu:
  - Bidirectional thực sự — client và server đều có thể push bất kỳ lúc nào
  - Tích hợp tốt với auth middleware hiện có (verifyIdToken trước khi upgrade connection)
- Nhược:
  - Server trở thành stateful — khó scale horizontal, cần Redis Adapter (socket.io-redis) nếu chạy nhiều instance
  - Sticky session hoặc Redis pub/sub phải được cấu hình đúng
- Phù hợp khi: Team kiểm soát infra, cần low-latency bidirectional, có thể cần nhiều hơn chỉ chat (typing indicator, presence)

---

### Hướng B: SSE (Server-Sent Events) + REST API
Mô tả: Client nhận messages qua SSE stream (server push), gửi messages qua POST REST, lưu PostgreSQL.
- Ưu:
  - Server vẫn stateless về mặt protocol (HTTP), dễ deploy hơn WebSocket
  - Không cần thư viện ngoài, auto-reconnect built-in ở browser
- Nhược:
  - Chỉ one-way (server → client) — gửi tin vẫn phải qua HTTP POST riêng
  - Mỗi client giữ 1 HTTP connection mở → giới hạn connection per domain (HTTP/1.1); HTTP/2 giải quyết nhưng phức tạp hơn
- Phù hợp khi: Scale nhỏ, không cần features phức tạp như typing indicator / presence, muốn giữ server đơn giản

---

### Hướng C: Firestore Realtime làm transport layer chat
Mô tả: Tận dụng Firestore (cùng hệ sinh thái Firebase đang dùng) làm real-time backend cho messages, PostgreSQL giữ metadata.
- Ưu:
  - Scale tự động, không tốn effort infra — Firebase lo hết phần real-time delivery
  - Offline support + auto-sync built-in từ Firebase SDK phía client
- Nhược:
  - Vendor lock-in sâu hơn — data chat nằm ở Firestore, không phải PostgreSQL → split data source phức tạp
  - ACL/phân quyền phải viết Firestore Security Rules riêng, tách biệt khỏi hệ thống role hiện tại (Redis + DB)
- Phù hợp khi: Không muốn maintain real-time infra, chấp nhận Firebase dependency, scale là ưu tiên cao nhất

---

## Đề xuất
Claude đề xuất **Hướng A (Socket.io)** vì: stack đã có Redis (dùng cho role cache) — thêm Redis Adapter cho Socket.io không tốn nhiều effort; auth middleware hiện tại dễ tích hợp vào WebSocket handshake; tránh split data source như Hướng C, và có room để mở rộng (typing indicator, presence) mà SSE không làm được tốt.

## Quyết định
**Chọn: raw WebSocket** (không dùng Socket.io) — mục tiêu hiểu flow thật sự ở protocol level trước khi nâng lên abstraction.

---

## System Design

### Data flow

**1. Connect (WS Handshake + Auth):**
```
Client
  → HTTP GET /ws?token=<firebase_id_token>   (Upgrade: websocket header)
  → server: http "upgrade" event
  → ws.auth.js: admin.auth().verifyIdToken(token)
      → invalid: socket.destroy() với HTTP 401
      → valid: wss.handleUpgrade() → ws.on("open")
  → ws.server.js: registry.set(uid, Set<ws>)   (in-memory Map)
```

**2. Gửi message (Client → Server → DB → Broadcast):**
```
Client
  → ws.send({ type: "message", roomId, content })
  → ws.handler.js: parse JSON, validate fields
  → chat.service.js: checkMembership(uid, roomId)
      → not member: ws.send({ type: "error", code: "FORBIDDEN" })
  → chat.service.js: prisma.message.create(...)  → DB
  → ws.handler.js: broadcast to all ws in room
      → chat.service.js: getRoomMembers(roomId)
      → mỗi member uid: registry.get(uid) → ws.send(messagePayload)
```

**3. Load history (REST):**
```
Client
  → GET /api/chat/rooms/:roomId/messages?before=<cursor>&limit=50
  → auth.mdw.js → verifyIdToken
  → chat.controller.js
  → chat.service.js: prisma.message.findMany({ where: { roomId, id < cursor }, orderBy: createdAt desc, take: 50 })
  → response: { messages[], nextCursor }
```

---

### DB changes

| Table | Field | Kiểu | Lý do |
|-------|-------|------|-------|
| `Room` (mới) | `id` | `String @id @default(uuid())` | PK |
| `Room` (mới) | `name` | `String` | Tên phòng hiển thị |
| `Room` (mới) | `created_by` | `String` (FK → User) | Ai tạo |
| `Room` (mới) | `created_at` | `DateTime` | Timestamp |
| `RoomMember` (mới) | `room_id` | `String` (FK → Room) | Composite PK |
| `RoomMember` (mới) | `user_id` | `String` (FK → User) | Composite PK |
| `RoomMember` (mới) | `joined_at` | `DateTime` | Audit |
| `Message` (mới) | `id` | `String @id @default(uuid())` | PK, dùng làm cursor |
| `Message` (mới) | `room_id` | `String` (FK → Room) | Phòng chứa message |
| `Message` (mới) | `sender_id` | `String` (FK → User) | Ai gửi |
| `Message` (mới) | `content` | `String @db.Text` | Nội dung |
| `Message` (mới) | `created_at` | `DateTime @default(now())` | Sort + cursor pagination |

Index cần thêm: `Message(room_id, created_at DESC)` — phục vụ load history.

---

### API changes

**REST (qua Express):**

```
GET  /api/chat/rooms
  → list rooms mà user đang là member
  → response: { rooms: [{ id, name, lastMessage? }] }

POST /api/chat/rooms
  body: { name }
  → tạo room + tự add creator làm member
  → response: { room: { id, name } }

POST /api/chat/rooms/:roomId/members
  body: { userId }
  → add user vào room (chỉ creator hoặc ADMIN)
  → response: { success: true }

GET  /api/chat/rooms/:roomId/messages?before=<uuid>&limit=50
  → load history với cursor pagination
  → response: { messages: [...], nextCursor: <uuid | null> }
```

**WebSocket (không qua Express router):**

```
ws://host/ws?token=<firebase_id_token>

Client → Server frames:
  { type: "message", roomId: "...", content: "..." }
  { type: "ping" }   (keepalive)

Server → Client frames:
  { type: "message", id, roomId, senderId, senderName, content, createdAt }
  { type: "error", code: "FORBIDDEN" | "INVALID_ROOM" | "CONTENT_TOO_LONG" }
  { type: "pong" }
```

---

### Edge cases

- **Token expired mid-session**: Firebase token có `exp` claim (1h). Server extract `exp` khi verify, schedule `setTimeout(() => ws.close(), remainingMs)` — đảm bảo connection không sống mãi sau khi token hết hạn.

- **Cùng user mở nhiều tab**: Registry dùng `Map<uid, Set<ws>>` thay vì `Map<uid, ws>` — broadcast tới tất cả ws của cùng uid.

- **User bị INACTIVE sau khi đã connect**: Mỗi message nhận vào, check `user.status` từ DB (hoặc có thể cache flag riêng). Nếu INACTIVE, đóng ws và từ chối message.

- **Gửi message vào room không phải member**: `checkMembership` trả về false → send error frame, không save DB, không broadcast.

- **Message quá dài / malformed JSON**: Validate content ≤ 2000 chars trước khi save. Parse JSON trong try/catch — nếu lỗi send error frame và skip.

---

### Risks

- **Stateful in-memory registry, không scale ngang**: Registry `Map<uid, ws>` chỉ tồn tại trong 1 process — nếu chạy 2 instance, user A ở instance 1 không nhận được message từ user B ở instance 2.
  → Mitigation: document rõ single-instance constraint. Khi cần scale: thêm Redis Pub/Sub (publish broadcast event lên channel, mỗi instance subscribe và forward tới local ws connections).

- **WebSocket không tích hợp được Express middleware chain**: `auth.mdw.js` hiện tại expect `req/res` — không dùng được trực tiếp cho WS upgrade event.
  → Mitigation: tạo `ws.auth.js` riêng extract token từ `req.url` query param, gọi `verifyIdToken` trực tiếp — tái sử dụng Firebase Admin config, không duplicate logic.

- **Broadcast O(n) per message với room lớn**: Mỗi message phải loop qua tất cả member để send — với room 1000 người sẽ chậm.
  → Mitigation: chấp nhận ở scale hiện tại. Document threshold (e.g. max 50 members/room) nếu cần giới hạn cứng.

---

### Files cần thay đổi

| File | Loại thay đổi | Ghi chú |
|------|--------------|---------|
| `backend/src/app.js` | Sửa | Tách `http.createServer(app)` ra ngoài để attach WS server cùng port |
| `backend/src/ws/ws.server.js` | Tạo mới | Khởi tạo `ws.WebSocketServer`, handle `upgrade` event, quản lý registry |
| `backend/src/ws/ws.auth.js` | Tạo mới | Extract + verify Firebase token từ WS handshake query param |
| `backend/src/ws/ws.handler.js` | Tạo mới | Parse incoming frames, dispatch theo `type`, gọi chat.service |
| `backend/src/services/chat.service.js` | Tạo mới | saveMessage, getRoomMessages, checkMembership, getRoomMembers |
| `backend/src/controllers/chat.controller.js` | Tạo mới | REST handlers: listRooms, createRoom, addMember, getMessages |
| `backend/src/routes/chat.routes.js` | Tạo mới | Mount REST routes vào Express |
| `backend/prisma/schema.prisma` | Sửa | Thêm model Room, RoomMember, Message |
| `backend/src/app.js` → `backend/src/server.js` | [TBD] | Có thể tách entry point riêng để test app.js dễ hơn |

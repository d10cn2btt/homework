# Tasks: chat-realtime

## Setup thủ công

- [x] Cài package `ws`: chạy `npm install ws` trong `backend/`
- [x] Sau khi sửa schema (task schema bên dưới): chạy `npx prisma db push` trong `backend/` (dùng thay migrate dev do môi trường non-interactive)
- [ ] Sau migrate: chạy `npx prisma generate` để update Prisma Client (cần đóng Node server trước — DLL bị lock)

---

## Backend

### DB Schema

- [x] `backend/prisma/schema.prisma` — thêm model `Room`: `id String @id @default(uuid())`, `name String`, `created_by String` (FK → User), `created_at DateTime @default(now())`, relations `members RoomMember[]` + `messages Message[]`

- [x] `backend/prisma/schema.prisma` — thêm model `RoomMember`: `room_id String` (FK → Room), `user_id String` (FK → User), `joined_at DateTime @default(now())`, `@@id([room_id, user_id])`

- [x] `backend/prisma/schema.prisma` — thêm model `Message`: `id String @id @default(uuid())`, `room_id String` (FK → Room), `sender_id String` (FK → User), `content String @db.Text`, `created_at DateTime @default(now())`, `@@index([room_id, created_at(sort: Desc)])`

- [x] `backend/prisma/schema.prisma` — thêm relations ngược vào model `User` hiện tại: `rooms_created Room[]`, `room_memberships RoomMember[]`, `messages Message[]`

<!-- cần chạy migrate sau khi hoàn thành 4 tasks schema trên -->

### Entry point refactor

- [x] `backend/src/server.js` — tạo mới: `require('./app')` → tạo `http.createServer(app)` → import `attachToServer` từ `ws/ws.server.js` → gọi `attachToServer(server)` → `server.listen(PORT)`. Đây là entry point thay thế block `app.listen()` hiện tại trong app.js

- [x] `backend/src/app.js` — xóa block `if (require.main === module) { app.listen(...) }` (đã chuyển sang server.js), thêm `app.use('/api/chat', require('./routes/chat.routes'))` ngay trước error handler

<!-- server.js phụ thuộc vào ws.server.js — tạo ws.server.js trước -->

### WS Auth

- [x] `backend/src/ws/ws.auth.js` — tạo mới: export async function `authenticateWS(req)`:
  - Parse token: `new URL(req.url, 'http://x').searchParams.get('token')`
  - Nếu không có token: throw `new Error('NO_TOKEN')`
  - Gọi `admin.auth().verifyIdToken(token)` (import admin từ `config/firebase.js`)
  - Return `{ uid: decoded.uid, email: decoded.email, exp: decoded.exp }`

### WS Server

- [x] `backend/src/ws/ws.server.js` — tạo mới, phần 1 — khởi tạo + registry:
  - `const wss = new WebSocketServer({ noServer: true })`
  - `const registry = new Map()` — kiểu `Map<uid, Set<ws>>`
  - Export `registry` và `attachToServer`

- [x] `backend/src/ws/ws.server.js` — phần 2 — implement `attachToServer(httpServer)`:
  - `httpServer.on('upgrade', async (req, socket, head) => { ... })`
  - Gọi `authenticateWS(req)`, nếu throw: `socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')` + `socket.destroy()` + return
  - Nếu pass: `wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, user))`

- [x] `backend/src/ws/ws.server.js` — phần 3 — handle `wss.on('connection', (ws, req, user))`:
  - Add ws vào registry: `if (!registry.has(uid)) registry.set(uid, new Set()); registry.get(uid).add(ws)`
  - Schedule token expire: `setTimeout(() => ws.close(), user.exp * 1000 - Date.now())`
  - `ws.on('message', rawData => handleMessage(ws, user.uid, rawData, registry))` (import từ ws.handler.js)
  - `ws.on('close', () => { registry.get(uid)?.delete(ws); if (!registry.get(uid)?.size) registry.delete(uid) })`

### WS Handler

- [x] `backend/src/ws/ws.handler.js` — tạo mới, phần 1 — parse + dispatch:
  - Export async function `handleMessage(ws, uid, rawData, registry)`
  - Wrap trong try/catch — nếu exception: `ws.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE' }))`
  - Parse: `const frame = JSON.parse(rawData.toString())`
  - Dispatch: `'ping'` → send pong; `'message'` → gọi `handleChatMessage(...)`; khác → send `INVALID_MESSAGE`

- [x] `backend/src/ws/ws.handler.js` — phần 2 — implement `handleChatMessage(ws, uid, frame, registry)` (function nội bộ):
  - Validate: `frame.roomId` và `frame.content` phải present, `content.length <= 2000` (nếu sai send `CONTENT_TOO_LONG`)
  - Gọi `checkMembership(uid, roomId)` — nếu false: send `{ type: 'error', code: 'FORBIDDEN' }` + return
  - Gọi `saveMessage(uid, roomId, content)` — nhận về saved message object
  - Broadcast: gọi `getRoomMembers(roomId)` → với mỗi `memberUid`: `registry.get(memberUid)?.forEach(sock => sock.send(JSON.stringify({ type: 'message', ...savedMessage })))`

<!-- ws.handler.js phụ thuộc vào chat.service.js — tạo service trước -->

### Chat Service — membership

- [x] `backend/src/services/chat.service.js` — tạo file + thêm hàm `checkMembership(uid, roomId)`:
  - `prisma.roomMember.findUnique({ where: { room_id_user_id: { room_id: roomId, user_id: uid } } })`
  - Return `boolean` (null → false)

- [x] `backend/src/services/chat.service.js` — thêm hàm `getRoomMembers(roomId)`:
  - `prisma.roomMember.findMany({ where: { room_id: roomId }, select: { user_id: true } })`
  - Return `string[]` (array uid)

<!-- cần migrate xong trước khi viết service -->

### Chat Service — message write/read

- [x] `backend/src/services/chat.service.js` — thêm hàm `saveMessage(uid, roomId, content)`:
  - `prisma.message.create({ data: { room_id: roomId, sender_id: uid, content }, include: { sender: { select: { id: true, display_name: true } } } })`
  - Return shape: `{ id, roomId: room_id, senderId: sender_id, senderName: sender.display_name, content, createdAt: created_at }`

- [x] `backend/src/services/chat.service.js` — thêm hàm `getRoomMessages(roomId, before, limit = 50)`:
  - `prisma.message.findMany({ where: { room_id: roomId, ...(before && { id: { lt: before } }) }, orderBy: { created_at: 'desc' }, take: limit, include: { sender: { select: { display_name: true } } } })`
  - Return `{ messages: [...mapped], nextCursor: messages.length === limit ? messages.at(-1).id : null }`

### Chat Service — room management

- [x] `backend/src/services/chat.service.js` — thêm hàm `listRooms(uid)`:
  - `prisma.roomMember.findMany({ where: { user_id: uid }, include: { room: { include: { messages: { orderBy: { created_at: 'desc' }, take: 1 } } } } })`
  - Return `[{ id, name, lastMessage: { content, createdAt } | null }]`

- [x] `backend/src/services/chat.service.js` — thêm hàm `createRoom(uid, name)`:
  - `prisma.room.create({ data: { name, created_by: uid, members: { create: { user_id: uid } } } })`
  - Return `{ id, name }`

- [x] `backend/src/services/chat.service.js` — thêm hàm `addMember(actorUid, roomId, targetUid)`:
  - Fetch room, nếu không tồn tại: throw AppError 404 `ROOM_NOT_FOUND`
  - Nếu `room.created_by !== actorUid`: throw AppError 403 `FORBIDDEN`
  - Check `targetUid` tồn tại trong User (throw 404 `USER_NOT_FOUND` nếu không)
  - `prisma.roomMember.create({ data: { room_id: roomId, user_id: targetUid } })` — nếu unique violation: throw 409 `ALREADY_MEMBER`

### REST Controller

- [x] `backend/src/controllers/chat.controller.js` — tạo mới, handler `listRooms`:
  - Gọi `chatService.listRooms(req.user.uid)`
  - Return `res.json({ success: true, data: rooms })`

- [x] `backend/src/controllers/chat.controller.js` — thêm handler `createRoom`:
  - Validate `req.body.name` present — nếu thiếu: `next(AppError(400, 'VALIDATION_ERROR'))`
  - Gọi `chatService.createRoom(req.user.uid, name)`
  - Return `res.status(201).json({ success: true, data: room })`

- [x] `backend/src/controllers/chat.controller.js` — thêm handler `addMember`:
  - Validate `req.body.userId` present
  - Gọi `chatService.addMember(req.user.uid, req.params.roomId, userId)`
  - Return `res.json({ success: true, data: null })`

- [x] `backend/src/controllers/chat.controller.js` — thêm handler `getMessages`:
  - Parse `before = req.query.before || null`, `limit = Math.min(Number(req.query.limit) || 50, 100)`
  - Gọi `chatService.getRoomMessages(req.params.roomId, before, limit)`
  - Return `res.json({ success: true, data: result.messages, meta: { nextCursor: result.nextCursor } })`

### REST Routes

- [x] `backend/src/routes/chat.routes.js` — tạo mới:
  - Import `authenticate` từ `middlewares/auth.mdw.js` và 4 handlers từ `chat.controller.js`
  - `GET  /rooms` → `[authenticate]` → `listRooms`
  - `POST /rooms` → `[authenticate]` → `createRoom`
  - `POST /rooms/:roomId/members` → `[authenticate]` → `addMember`
  - `GET  /rooms/:roomId/messages` → `[authenticate]` → `getMessages`

---

## Tests

- [x] `backend/src/tests/chat/ws-auth.test.js` — test WS handshake:
  - Connect với valid token → status `open`
  - Connect không có token → connection bị reject (close event hoặc error)
  - Connect với token invalid → connection bị reject

- [x] `backend/src/tests/chat/ws-ping.test.js` — test keepalive:
  - Gửi `{ type: 'ping' }` → nhận `{ type: 'pong' }`
  - Gửi malformed JSON → nhận `{ type: 'error', code: 'INVALID_MESSAGE' }`

- [x] `backend/src/tests/chat/ws-message.test.js` — test gửi message:
  - User A và B cùng room, A gửi message → B nhận frame `{ type: 'message', content, senderId }`
  - User gửi vào room không phải member → nhận `{ type: 'error', code: 'FORBIDDEN' }`
  - User gửi content > 2000 chars → nhận `{ type: 'error', code: 'CONTENT_TOO_LONG' }`
  - User gửi thiếu `roomId` hoặc `content` → nhận `{ type: 'error', code: 'INVALID_MESSAGE' }`

- [x] `backend/src/tests/chat/chat-rooms.test.js` — test REST room management:
  - `POST /api/chat/rooms` với name hợp lệ → 201, creator tự là member
  - `POST /api/chat/rooms` thiếu name → 400
  - `GET /api/chat/rooms` → chỉ trả rooms user đang là member (không trả room khác)
  - `POST /api/chat/rooms/:id/members` với actor là creator → 200
  - `POST /api/chat/rooms/:id/members` với actor không phải creator → 403
  - `POST /api/chat/rooms/:id/members` với userId đã là member → 409

- [x] `backend/src/tests/chat/chat-messages.test.js` — test REST load history:
  - `GET /api/chat/rooms/:id/messages` không có before → trả 50 messages mới nhất
  - `GET /api/chat/rooms/:id/messages?limit=2` → trả đúng 2 messages, `nextCursor` có giá trị
  - `GET /api/chat/rooms/:id/messages?before=<cursor>` → trả messages trước cursor, không include cursor message

---

## Frontend

- [x] `frontend/src/api/chat.api.js` — tạo mới, 4 functions dùng axios instance từ `api/axios.js`:
  - `listRooms()` → `GET /api/chat/rooms`
  - `createRoom(name)` → `POST /api/chat/rooms` body `{ name }`
  - `addMember(roomId, userId)` → `POST /api/chat/rooms/${roomId}/members` body `{ userId }`
  - `getMessages(roomId, { before, limit } = {})` → `GET /api/chat/rooms/${roomId}/messages` với query params

- [x] `frontend/src/hooks/useWebSocket.js` — tạo mới: custom hook `useWebSocket(token)`:
  - Tạo `new WebSocket(\`ws://${host}/ws?token=${token}\`)` khi mount, `ws.close()` khi unmount
  - State: `messages = []` (realtime messages mới nhận), `status = 'connecting'|'open'|'closed'`
  - `ws.onmessage`: parse JSON, nếu `type === 'message'` → append vào `messages`
  - Export `sendMessage(roomId, content)`: `ws.send(JSON.stringify({ type: 'message', roomId, content }))`
  - Auto-reconnect đơn giản: `ws.onclose → setTimeout(reconnect, 3000)` (chỉ nếu không phải unmount intentional)

- [x] `frontend/src/components/chat/RoomList.jsx` — tạo mới:
  - Props: `rooms[]`, `selectedRoomId`, `onSelect(roomId)`, `onCreate(name)`
  - Render list, highlight selected room, hiển thị `lastMessage.content` preview nếu có
  - Nút "+" → inline input nhập tên → submit gọi `onCreate`

- [x] `frontend/src/components/chat/MessageList.jsx` — tạo mới:
  - Props: `messages[]`, `hasMore`, `onLoadMore()`
  - Render messages oldest → newest (reverse sort), auto scroll to bottom khi `messages` thay đổi (`useEffect` + `ref`)
  - Nút "Load earlier" ở đầu danh sách nếu `hasMore === true`
  - Mỗi message hiển thị: `senderName`, `content`, `createdAt` (format thời gian)

- [x] `frontend/src/components/chat/MessageInput.jsx` — tạo mới:
  - Props: `onSend(content)`, `disabled`
  - Textarea + nút Send
  - Enter → submit, Shift+Enter → xuống dòng
  - Clear input sau khi gửi thành công
  - `disabled` khi WS status không phải `'open'`

- [x] `frontend/src/pages/ChatPage.jsx` — tạo mới:
  - Dùng `useWebSocket(user.token)` lấy `{ messages: realtimeMessages, sendMessage, status }`
  - State: `rooms[]`, `selectedRoomId`, `historyMessages[]`, `nextCursor`, `hasMore`
  - `useEffect` → `listRooms()` khi mount, set `rooms`
  - Khi `selectedRoomId` thay đổi: gọi `getMessages(roomId)` → set `historyMessages` + `nextCursor` (reset cũ)
  - `onLoadMore`: gọi `getMessages(roomId, { before: nextCursor })` → prepend vào `historyMessages`
  - Merge để hiển thị: `[...historyMessages, ...realtimeMessages]` (dedup theo `id`)
  - Layout 2 cột: `<RoomList>` sidebar trái + `<MessageList>` + `<MessageInput>` phần phải

- [x] `frontend/src/App.jsx` — thêm route `/chat` trỏ tới `<ChatPage>` wrap bởi `<ProtectedRoute>` (đã có sẵn trong codebase)
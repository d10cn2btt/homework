# Tasks: chat-load-balancing

## Hiện trạng codebase
- Backend: Express + WS server chạy cùng process tại port 3000, WS sống trong `backend/src/ws/`
- Frontend: `useWebSocket.js` connect tới `ws://api:3000/ws?token=...`
- Docker compose hiện tại: 1 api service, 1 frontend, postgres, redis
- Message model: room-based (`room_id` + `sender_id`), chưa có field `status`
- **Không có** `gateway/` hay `nginx/` thư mục

---

## Setup thủ công
- [ ] Tạo thư mục `gateway/` trong root project (cùng cấp với `backend/`, `frontend/`)
- [ ] Tạo thư mục `nginx/` trong root project
- [ ] Thêm vào `.env` (root): `VITE_GATEWAY_URL=ws://localhost:8080`

---

## Infrastructure

### Nginx
- [ ] `nginx/nginx.conf` — tạo mới: upstream block `instance_pool` gồm `instance-1:3000`, `instance-2:3000`, `instance-3:3000`; server listen :80 proxy tới pool; **block location `/internal`** (return 403) để không expose internal endpoints ra ngoài; location `/` proxy bình thường

### Docker Compose
- [ ] `docker-compose.yml` — sửa: thêm service `gateway` (build: ./gateway, ports: 8080:8080, env: `PORT=8080`, `NGINX_URL=http://nginx:80`, `GATEWAY_SELF_URL=http://gateway:8080`); thêm service `nginx` (image: nginx:alpine, volumes: ./nginx/nginx.conf); đổi service `api` thành 3 services `instance-1`, `instance-2`, `instance-3` (mỗi cái build: ./backend, PORT=3000, thêm env `GATEWAY_URL=http://gateway:8080`)
<!-- depends_on: instance-1/2/3 → [redis, postgres]; nginx → [instance-1/2/3]; gateway → [nginx] -->

### Gateway Setup
- [ ] `gateway/package.json` — tạo mới: dependencies `ws`, `firebase-admin`, `axios`, `uuid`; scripts `start: node index.js`
- [ ] `gateway/Dockerfile` — tạo mới: `FROM node:20-slim`, WORKDIR /app, COPY package*.json, `RUN npm ci --only=production`, COPY . ., EXPOSE 8080, `CMD ["node", "index.js"]`

---

## Gateway (service mới)

- [ ] `gateway/conn-registry.js` — tạo mới: module export object với in-memory `Map`; methods: `set(connId, ws)`, `get(connId) → ws|undefined`, `delete(connId)`, `has(connId) → bool`; không Redis, không persist

- [ ] `gateway/ws-auth.js` — tạo mới: function `verifyToken(token) → { uid, exp }`; dùng `admin.auth().verifyIdToken(token)`; throw nếu invalid; export `initFirebase()` để gọi 1 lần khi boot
<!-- gateway cần env: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL -->

- [ ] `gateway/deliver.route.js` — tạo mới: Express Router; `POST /deliver`: nhận body `{ connId, payload }`; nếu `registry.has(connId)` → `ws.send(JSON.stringify(payload))` → `res.json({ success: true })`; nếu không → `res.status(404).json({ success: false, error: 'CONN_NOT_FOUND' })`

- [ ] `gateway/ws-handler.js` — tạo mới: function `handleConnection(ws, req)`:
  - Extract token từ query string → `verifyToken()` → nếu fail → `ws.close(4001)` return
  - Tính token TTL: `setTimeout(() => ws.close(4002), exp*1000 - Date.now() - 60_000)`
  - Sinh `connId = uuid()`, `registry.set(connId, ws)`
  - Gọi `axios.post(NGINX_URL + '/internal/ws/connect', { userId, connId, gatewayUrl: GATEWAY_SELF_URL })`
  - `ws.on('message', data)`: parse JSON → `axios.post(NGINX_URL + '/internal/ws/message', { from: userId, connId, roomId: data.roomId, content: data.content })` → nếu axios error → `ws.send(JSON.stringify({ type: 'error', code: 'INTERNAL_ERROR' }))`
  - `ws.on('close')`: `registry.delete(connId)` → `axios.post(NGINX_URL + '/internal/ws/disconnect', { userId, connId })`
  - `ws.on('error')`: log → `ws.close()`

- [ ] `gateway/index.js` — tạo mới: `initFirebase()` → tạo `http.createServer(expressApp)` (mount `deliver.route.js` + `GET /health`) → `new WebSocketServer({ server })` → `wss.on('connection', handleConnection)` → `server.listen(PORT)`

---

## Backend Instance (sửa existing)

### DB Migration
- [ ] `backend/prisma/schema.prisma` — sửa: thêm enum `MessageStatus { SENT DELIVERED }`; thêm field `status MessageStatus @default(SENT)` vào model `Message`
- [ ] Chạy migrate: `docker compose exec instance-1 npx prisma migrate dev --name add_message_status`

### New Services
- [ ] `backend/src/services/ws-registry.service.js` — tạo mới, 3 functions:
  - `register(userId, connId, gatewayUrl)`: GET `ws:registry:{userId}` → parse array → push `{connId, gatewayUrl}` → SET JSON với EX 7200
  - `deregister(userId, connId)`: GET key → filter bỏ entry có connId đó → nếu còn lại > 0 → SET lại; nếu empty → DEL
  - `lookup(userId) → [{connId, gatewayUrl}]`: GET key → parse → return array (hoặc `[]`)

- [ ] `backend/src/services/gateway-client.service.js` — tạo mới, function `deliver(gatewayUrl, connId, payload)`:
  - `axios.post(gatewayUrl + '/deliver', { connId, payload }, { timeout: 3000 })`
  - Retry tối đa 3 lần: delay 100ms → 300ms → 1s
  - Nếu response 404 (`CONN_NOT_FOUND`) → gọi `wsRegistryService.deregister(userId, connId)` → return `{ success: false }`
  - Nếu thành công → return `{ success: true }`
  - Nếu network error sau 3 lần → log warn → return `{ success: false }`
  <!-- hàm này cần nhận thêm userId để deregister được khi CONN_NOT_FOUND -->

### Internal Controller & Route
- [ ] `backend/src/controllers/internal/ws.controller.js` — tạo mới, 3 handlers:
  - `handleConnect(req, res)`: `{ userId, connId, gatewayUrl }` → `wsRegistryService.register()` → `res.json({ ok: true })`
  - `handleMessage(req, res)`: `{ from, roomId, content, connId }` → `chatService.saveAndBroadcast(from, roomId, content)` → `res.json({ ok: true, data: result })`
  - `handleDisconnect(req, res)`: `{ userId, connId }` → `wsRegistryService.deregister()` → `res.json({ ok: true })`

- [ ] `backend/src/routes/internal/ws.route.js` — tạo mới: Router; `POST /connect`, `POST /message`, `POST /disconnect` → handlers tương ứng; **không mount auth middleware** (internal, blocked ở Nginx)

### Sửa Existing
- [ ] `backend/src/services/chat.service.js` — thêm function `saveAndBroadcast(fromId, roomId, content)`:
  - Gọi `saveMessage()` (đã có) → lấy `message` object
  - Gọi `getRoomMembers(roomId)` (đã có) → lấy array `userIds`
  - Với mỗi memberId: `wsRegistryService.lookup(memberId)` → với mỗi entry: `gatewayClientService.deliver(gatewayUrl, connId, { type: 'message', data: message })`
  - Nếu ít nhất 1 deliver thành công → `prisma.message.update({ status: 'DELIVERED' })`
  - Return `{ messageId: message.id, deliveredCount: number }`

- [ ] `backend/src/app.js` — sửa: mount `/internal/ws` → `routes/internal/ws.route.js`; thêm `GET /health → res.json({ instance: process.env.HOSTNAME })` trước các middleware khác

- [ ] `backend/src/server.js` — sửa: xóa toàn bộ WS server setup (import + `new WebSocketServer(...)` + attach logic); giữ nguyên HTTP server

- [ ] `backend/src/ws/` — xóa 3 file: `ws.server.js`, `ws.handler.js`, `ws.auth.js` (Gateway đảm nhiệm hết)

### Missed Messages khi Reconnect
- [ ] `backend/src/services/chat.service.js` — sửa function `getRoomMessages()` (đã có): thêm support query param `since` (ISO timestamp) — nếu có `since` thì filter `created_at > since` thay vì dùng cursor `before`

- [ ] `backend/src/controllers/chat.controller.js` — sửa handler `getMessages`: nếu query có `since` → truyền xuống service; giữ nguyên logic `before` cursor nếu không có `since`

---

## Tests

- [ ] `ws-registry.service`: `register()` → `lookup()` trả đúng array; `deregister()` xóa đúng connId; DEL key khi array empty
- [ ] `gateway-client.service`: mock axios fail 2 lần rồi succeed → verify 3 lần gọi; mock 404 → verify `deregister()` được gọi
- [ ] `POST /internal/ws/connect`: body hợp lệ → 200 + Redis key `ws:registry:{userId}` tồn tại
- [ ] `POST /internal/ws/message`: members có entries trong Redis → `deliver()` được gọi cho từng member → response `{ ok: true }`
- [ ] `POST /internal/ws/message`: tất cả members offline (Redis empty) → message vẫn persist DB với `status: SENT`, response `{ ok: true, data: { deliveredCount: 0 } }`
- [ ] `POST /internal/ws/disconnect`: Redis entry bị xóa
- [ ] Multi-device: 1 user có 2 connIds → `deliver()` gọi 2 lần; 1 CONN_NOT_FOUND → entry đó deregister, entry kia deliver thành công

---

## Frontend

- [ ] `frontend/src/hooks/useWebSocket.js` — sửa WS URL: `${import.meta.env.VITE_GATEWAY_URL}/ws?token=...`; thêm exponential backoff reconnect (1s→2s→4s→8s→16s→30s cap); xử lý `onclose` theo close code:
  - `1001` → reconnect với backoff
  - `4001` → không reconnect, navigate `/login`
  - `4002` → `firebase.currentUser.getIdToken(true)` (force refresh) → reconnect với token mới
  - `4003` → không reconnect

- [ ] `frontend/src/pages/ChatPage.jsx` — thêm logic fetch missed messages sau khi WS reconnect thành công: gọi `GET /api/chat/rooms/:roomId/messages?since=<lastMessageTimestamp>` → merge vào message list (dedup theo `id`)

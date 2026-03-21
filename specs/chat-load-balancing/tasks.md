# Tasks: chat-load-balancing

## Hiện trạng codebase
- Backend: Express + WS server chạy cùng process tại port 3000, WS sống trong `backend/src/ws/`
- Frontend: `useWebSocket.js` connect tới `ws://api:3000/ws?token=...`
- Docker compose hiện tại: 1 api service, 1 frontend, postgres, redis
- Message model: room-based (`room_id` + `sender_id`), chưa có field `status`
- **Không có** `gateway/` hay `nginx/` thư mục

---

## Setup thủ công
- [x] Tạo thư mục `gateway/` trong root project (cùng cấp với `backend/`, `frontend/`)
- [x] Tạo thư mục `nginx/` trong root project
- [x] Thêm vào `.env` (root): `VITE_GATEWAY_URL=ws://localhost:8080`

---

## Infrastructure

### Nginx
- [x] `nginx/nginx.conf` — upstream block `instance_pool` gồm `instance-1:3000`, `instance-2:3000`, `instance-3:3000`; server listen :80 proxy tới pool; **block location `/internal`** (return 403); location `/` proxy bình thường

### Docker Compose
- [x] `docker-compose.yml` — thêm service `gateway` + `nginx`; đổi service `api` thành 3 services `instance-1`, `instance-2`, `instance-3`; thêm env `GATEWAY_URL=http://gateway:8080` cho mỗi instance

### Gateway Setup
- [x] `gateway/package.json` — dependencies `ws`, `firebase-admin`, `axios`, `uuid`; `"type": "module"`
- [x] `gateway/Dockerfile` — `FROM node:20-slim`

---

## Gateway (service mới)

- [x] `gateway/conn-registry.js` — in-memory `Map`: `set`, `get`, `delete`, `has`
- [x] `gateway/ws-auth.js` — `verifyToken(token) → { uid, exp }`, `initFirebase()`
- [x] `gateway/deliver.route.js` — `POST /deliver`: lookup registry → `ws.send()` hoặc 404 `CONN_NOT_FOUND`
- [x] `gateway/ws-handler.js` — `handleConnection`: verify token, sinh connId, handle `ping/message/close/error`
- [x] `gateway/index.js` — boot: `initFirebase()` + HTTP server + WS server
- [x] `gateway/ws-protocol.js` — constants: `WS_CLOSE`, `WS_ERROR`, `WS_CLIENT_TYPE`, `WS_SERVER_TYPE`, `wsError()`

---

## Backend Instance (sửa existing)

### DB Migration
- [x] `backend/prisma/schema.prisma` — thêm enum `MessageStatus { SENT DELIVERED }`, field `status MessageStatus @default(SENT)` vào `Message`
- [ ] Chạy migrate: `docker compose exec instance-1 npx prisma migrate dev --name add_message_status`

### New Services
- [x] `backend/src/services/ws-registry.service.js` — `register`, `deregister`, `lookup`
- [x] `backend/src/services/gateway-client.service.js` — `deliver` với retry 3 lần + deregister khi CONN_NOT_FOUND

### Internal Controller & Route
- [x] `backend/src/controllers/internal/ws.controller.js` — `handleConnect`, `handleMessage`, `handleDisconnect`
- [x] `backend/src/routes/internal/ws.route.js` — `POST /connect`, `/message`, `/disconnect`

### Sửa Existing
- [x] `backend/src/services/chat.service.js` — thêm `saveAndBroadcast`, sửa `getRoomMessages` support `since`
- [x] `backend/src/controllers/chat.controller.js` — xóa `broadcastToRoom` + import `ws.server.js`; sửa `getRoomMessages` signature; thêm `since` param
- [x] `backend/src/app.js` — mount `/internal/ws`; sửa `/health` trả `instance: HOSTNAME`
- [x] `backend/src/server.js` — xóa WS server setup, giữ pure HTTP
- [x] `backend/src/ws/` — đã xóa toàn bộ (`ws.server.js`, `ws.handler.js`, `ws.auth.js`)

---

## Tests

- [x] `ws-registry.service`: `register()` → `lookup()` trả đúng array; `deregister()` xóa đúng connId; DEL key khi array empty
- [x] `gateway-client.service`: mock axios fail 2 lần rồi succeed → verify 3 lần gọi; mock 404 → verify `deregister()` được gọi
- [x] `POST /internal/ws/connect`: body hợp lệ → 200 + Redis key `ws:registry:{userId}` tồn tại
- [x] `POST /internal/ws/message`: members có entries trong Redis → `deliver()` được gọi cho từng member → response `{ ok: true }`
- [x] `POST /internal/ws/message`: tất cả members offline (Redis empty) → message vẫn persist DB với `status: SENT`, response `{ ok: true, data: { deliveredCount: 0 } }`
- [x] `POST /internal/ws/disconnect`: Redis entry bị xóa
- [x] Multi-device: 1 user có 2 connIds → `deliver()` gọi 2 lần; 1 CONN_NOT_FOUND → entry đó deregister, entry kia deliver thành công

---

## Frontend
> Các task Frontend đã được move sang `tech-debt.md` vì không blocking cho load-balancing backend.

- [x] `frontend/src/hooks/useWebSocket.js` — sửa WS URL sang `VITE_GATEWAY_URL`; exponential backoff; xử lý close codes 4001/4002/4003/1001
- [x] `frontend/src/pages/ChatPage.jsx` — fetch missed messages sau khi WS reconnect

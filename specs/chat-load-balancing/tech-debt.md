# Tech Debt: Chat BE ↔ FE

> Phát hiện trong quá trình làm feature load-balancing.
> **Quay lại làm sau khi xong load-balancing.**

---

## 1. REST API — Silent error (FE)

Hầu hết các handler trong `ChatPage.jsx` catch error nhưng không show gì cho user:

| Handler | Error bị bỏ qua |
|---|---|
| `handleCreateRoom` | 400 VALIDATION_ERROR |
| `handleJoin` | 404 ROOM_NOT_FOUND, 409 ALREADY_MEMBER |
| `handleRenameSubmit` | 404 ROOM_NOT_FOUND, 403 FORBIDDEN |
| `handleDelete` | 404 ROOM_NOT_FOUND, 403 FORBIDDEN |

`handleLeave` có show alert nhưng check sai field — cần verify format error response từ BE.

**Cần làm:** Thêm toast notification (hoặc error state) cho từng case. Map error code → message thân thiện với user.

---

## 2. REST API — Signature mismatch (BE)

`chat.controller.js` gọi `getRoomMessages` với positional params:
```js
chatService.getRoomMessages(req.params.roomId, before, limit)
```
Nhưng `chat.service.js` đã đổi sang object param:
```js
getRoomMessages(roomId, { before, since, limit })
```
→ **Sẽ break `getMessages` endpoint.**

**Cần làm:** Cập nhật `chat.controller.js` → `chatService.getRoomMessages(roomId, { before, limit })`.

---

## 3. REST API — `addMember` thiếu trong service (BE)

`chat.controller.js` gọi `chatService.addMember()` nhưng function này không tồn tại trong `chat.service.js`.

**Cần làm:** Implement `addMember(callerUid, roomId, targetUserId)` trong `chat.service.js` — check caller là creator/admin, add target vào RoomMember, tạo SYSTEM message.

---

## 4. WebSocket — Close codes chưa xử lý (FE)

`useWebSocket.js` reconnect cho mọi close code với delay cố định 3s:

| Code | Cần xử lý | Hiện tại |
|---|---|---|
| `4001` token invalid | Redirect `/login`, không reconnect | ❌ Reconnect loop |
| `4002` token expired | Firebase refresh token → reconnect | ❌ Reconnect với token cũ → bị 4001 |
| `4003` duplicate conn | Không reconnect | ❌ Reconnect loop |
| `1001` gateway restart | Reconnect với exponential backoff | ⚠️ Reconnect nhưng không có backoff |

**Cần làm:** Sửa `onclose` handler trong `useWebSocket.js` theo close code spec trong `gateway/FLOW.md`.

---

## 5. WebSocket — Error frames không được xử lý (FE)

`useWebSocket.js` chỉ handle `type === 'message'` và `type === 'system'`. Frame `type === 'error'` bị bỏ qua hoàn toàn.

Error frames từ Gateway/Instance:
```json
{ "type": "error", "code": "DELIVER_FAILED", "messageId": "...", "reason": "recipient_offline" }
{ "type": "error", "code": "INVALID_PAYLOAD", "reason": "missing field: roomId" }
{ "type": "error", "code": "INTERNAL_ERROR", "messageId": "..." }
```

**Cần làm:** Handle `type === 'error'` trong `onmessage` → show toast tương ứng trong `ChatPage.jsx`.

---

## 6. WebSocket — Ping bị forward lên Instance (Gateway)

FE gửi `{ type: 'ping' }` mỗi 30s để giữ connection alive. Gateway `ws-handler.js` hiện forward **tất cả** messages lên `/internal/ws/message`, kể cả ping → Instance gọi `saveAndBroadcast(uid, undefined, undefined)` → crash.

**Cần làm:** Thêm vào `gateway/ws-handler.js` trước khi forward:
```js
if (parsed.type === 'ping') {
  ws.send(JSON.stringify({ type: 'pong' }));
  return;
}
```

---

## 7. WebSocket — WS URL env var chưa đổi (FE)

`useWebSocket.js` đang đọc `VITE_WS_URL`, nhưng cần đổi sang `VITE_GATEWAY_URL` theo kiến trúc mới.

**Cần làm:** Sửa `useWebSocket.js` line 15: `import.meta.env.VITE_WS_URL` → `import.meta.env.VITE_GATEWAY_URL`.

---

## 8. chat.controller.js — Import ws.server.js sẽ crash sau khi xóa ws/ folder

```js
import { registry } from '../ws/ws.server.js'; // file này bị xóa trong load-balancing task
function broadcastToRoom(...) { ... }           // dùng registry cũ
```

`broadcastToRoom` được gọi trong `joinRoom` và `leaveRoom` controller. Sau khi xóa `ws/` folder, import này sẽ crash toàn bộ app.

**Cần làm:** Xóa `broadcastToRoom` + import `ws.server.js` khỏi `chat.controller.js`. Broadcast giờ do `saveAndBroadcast` trong service lo — controller không cần gọi broadcast thủ công nữa. *(Task này thực ra thuộc load-balancing, không phải tech debt — cần làm ngay.)*

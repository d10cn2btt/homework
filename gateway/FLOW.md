# Gateway: Data Flow & Workflow

## Tổng quan kiến trúc

Gateway là **cầu nối duy nhất** giữa browser và backend instances.
Nó xử lý 2 chiều traffic:

```
Browser ──WS──────→ Gateway ──HTTP──→ Nginx ──→ Instance
Instance ──HTTP──→ Gateway ──WS────→ Browser
```

Gateway **không chứa business logic** — nó chỉ:
1. Xác thực token Firebase khi client connect
2. Duy trì WebSocket connection với client (lưu trong RAM)
3. Forward message từ client xuống Instance
4. Nhận lệnh deliver từ Instance và push xuống đúng client

---

## File nào làm gì

| File | Vai trò |
|---|---|
| `index.js` | Entry point: khởi động HTTP server + WS server trên cùng port 8080 |
| `ws-auth.js` | Xác thực Firebase ID Token, trả về `{ uid, exp }` |
| `ws-handler.js` | Xử lý lifecycle của 1 WS connection: connect / message / close / error |
| `conn-registry.js` | Lưu mapping `connId → ws socket` trong RAM (Map) |
| `deliver.route.js` | HTTP endpoint `POST /deliver` để Instance ra lệnh push message tới client |

---

## Flow 1: Client kết nối

```
Browser mở WebSocket:
ws://localhost:8080/ws?token=<Firebase ID Token>
        │
        ▼
[ws-handler.js] handleConnection(ws, req)
        │
        ├─ 1. Parse token từ query string
        │
        ├─ 2. verifyToken(token)  [ws-auth.js]
        │       │
        │       ├─ OK  → { uid, exp }
        │       └─ FAIL → ws.close(4001)  ──→ Browser biết token invalid, redirect login
        │
        ├─ 3. Tính TTL token: exp * 1000 - Date.now() - 60s
        │      setTimeout(() => ws.close(4002), TTL)
        │      → Trước khi token hết hạn 1 phút, Gateway tự close
        │      → Browser nhận close code 4002 → tự refresh token → reconnect
        │
        ├─ 4. Sinh connId = uuid()  (ví dụ: "a1b2-c3d4-...")
        │      registry.set(connId, ws)  [conn-registry.js]
        │      → connId là định danh duy nhất cho connection này trong RAM của Gateway
        │
        └─ 5. Báo cho Instance biết user đã online:
               POST http://nginx/internal/ws/connect
               Body: { userId, connId, gatewayUrl: "http://gateway:8080" }
               │
               ▼
           Instance ghi Redis:
           ws:registry:{userId} = [{ connId: "a1b2-c3d4", gatewayUrl: "http://gateway:8080" }]
           TTL: 2 giờ
```

---

## Flow 2: Client gửi message vào room

```
Browser gửi WS frame (JSON string):
{ "roomId": "room-abc", "content": "hello everyone" }
        │
        ▼
[ws-handler.js] ws.on('message')
        │
        ├─ Parse JSON
        │
        └─ POST http://nginx/internal/ws/message
           Body: { from: userId, connId, roomId, content }
                   │
                   ▼ (Nginx load balance đến 1 trong 3 instances)
           [Instance] internal/ws.controller → chatService.saveAndBroadcast()
                   │
                   ├─ 1. saveMessage() → lưu DB, lấy messageId
                   │
                   ├─ 2. getRoomMembers(roomId) → [userA, userB, userC, ...]
                   │
                   └─ 3. Với mỗi member:
                           lookup Redis ws:registry:{memberId}
                           → [{ connId: "x1y2", gatewayUrl: "http://gateway:8080" }]
                           │
                           └─ POST http://gateway:8080/deliver
                              Body: { connId: "x1y2", payload: { type: "message", data: {...} } }
                                      │
                                      ▼
                              [deliver.route.js]
                                      │
                                      ├─ registry.get("x1y2") → ws socket
                                      └─ ws.send(JSON.stringify(payload))
                                              │
                                              ▼
                                      Browser của member nhận message realtime ✓
```

**Trường hợp member offline** (không có entry trong Redis):
- Instance bỏ qua member đó, message vẫn được lưu DB
- Khi member online trở lại và reconnect, frontend fetch missed messages qua REST API

**Trường hợp connId không còn trong registry** (CONN_NOT_FOUND):
- Gateway trả 404
- Instance gọi `wsRegistryService.deregister()` để xóa stale entry khỏi Redis

---

## Flow 3: Client ngắt kết nối

```
Browser đóng tab / mất mạng / bị timeout
        │
        ▼
[ws-handler.js] ws.on('close')
        │
        ├─ 1. registry.delete(connId)
        │      → Xóa khỏi RAM của Gateway ngay lập tức
        │
        └─ 2. POST http://nginx/internal/ws/disconnect
               Body: { userId, connId }
               │
               ▼
           Instance xóa entry khỏi Redis:
           ws:registry:{userId} filter bỏ connId này
           Nếu user không còn connection nào → DEL key
```

---

## Tại sao cần Gateway? (Vấn đề khi scale)

**Không có Gateway — chạy nhiều Instance:**
```
Browser-A ──WS──→ Instance-1  (Instance-1 giữ socket của A)
Browser-B ──WS──→ Instance-2  (Instance-2 giữ socket của B)

Khi B gửi message vào room có A:
Instance-2 muốn push cho A
→ Instance-2 KHÔNG BIẾT A đang ở Instance-1
→ Không broadcast được ✗
```

**Có Gateway:**
```
Browser-A ──WS──→ Gateway  (Gateway giữ tất cả sockets)
Browser-B ──WS──→ Gateway

Redis biết: A → [{ connId: "a1", gatewayUrl: "http://gateway:8080" }]
            B → [{ connId: "b1", gatewayUrl: "http://gateway:8080" }]

Khi B gửi message → Instance bất kỳ xử lý
→ Instance hỏi Redis → tìm ra connId của A → gọi Gateway /deliver
→ Gateway push tới đúng socket của A ✓
```

Gateway là **single source of truth** cho tất cả WS connections,
cho phép backend scale thành nhiều instances mà không mất khả năng broadcast.

---

## Close codes

| Code | Ý nghĩa | Frontend xử lý |
|---|---|---|
| `4001` | Token invalid / không có token | Redirect về `/login`, không reconnect |
| `4002` | Token sắp hết hạn | Refresh Firebase token → reconnect |
| `4003` | Tab cũ bị replace (future use) | Không reconnect |
| `1001` | Gateway restart / deploy | Reconnect với exponential backoff |

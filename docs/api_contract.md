📝 API Contract & Convention

Tài liệu này định nghĩa các quy chuẩn giao tiếp (API Convention) giữa Frontend (React) và Backend (Express), đồng thời liệt kê danh sách các API cốt lõi của hệ thống.

1. Quy chuẩn chung (General Conventions)

1.1. Base URL & Authentication

Base URL: /api/v1 (Ví dụ: https://api.domain.com/api/v1)

Authentication: Tất cả các API yêu cầu xác thực (Private) đều phải đính kèm Header:

Authorization: Bearer <FIREBASE_ID_TOKEN>


1.2. Chuẩn HTTP Status Codes

Backend bắt buộc phải trả về đúng Status Code để Frontend dễ dàng dùng Axios Interceptor bắt lỗi toàn cục:

200 OK: Xử lý thành công.

201 Created: Tạo mới tài nguyên thành công.

400 Bad Request: Client gửi sai định dạng dữ liệu (Validation Error).

401 Unauthorized: Token hết hạn, sai hoặc chưa gửi Token. (FE tự động redirect về trang Login).

403 Forbidden: Token hợp lệ nhưng User không đủ quyền (Role) thực hiện. (FE hiện màn hình Access Denied).

404 Not Found: Không tìm thấy tài nguyên.

500 Internal Server Error: Lỗi logic Backend hoặc Database.

1.3. Định dạng Response chuẩn (Standard Response Format)

Hệ thống thống nhất một format JSON duy nhất cho mọi Response.

✅ Thành công (Success Response):

{
  "success": true,
  "data": { ... }, // Payload dữ liệu chính (Object hoặc Array)
  "meta": { ... }  // (Tùy chọn) Dùng cho phân trang: { "page": 1, "limit": 10, "total": 50 }
}


❌ Thất bại (Error Response):

{
  "success": false,
  "error": {
    "code": "ERROR_CODE_NAME", // Mã lỗi để FE dễ map với nội dung đa ngôn ngữ (i18n)
    "message": "Thông báo lỗi chi tiết để dev debug",
    "details": [] // (Tùy chọn) Danh sách lỗi chi tiết nếu là lỗi Validation Form
  }
}


2. Danh sách API cốt lõi (Core Endpoints)

2.1. Quản lý bản thân (Profile)

GET /api/v1/users/me

Mô tả: Lấy thông tin profile và role của user đang đăng nhập. FE gọi API này sau khi đăng nhập thành công để lưu vào Context/Redux.

Quyền (ACL): Bất kỳ user nào đã đăng nhập.

Response:

{
  "success": true,
  "data": {
    "id": "firebase_uid_123",
    "email": "user@example.com",
    "display_name": "Nguyen Van A",
    "roles": ["USER"]
  }
}


2.2. Quản lý Người dùng (Dành cho Admin)

GET /api/v1/users

Mô tả: Lấy danh sách toàn bộ user (có phân trang).

Quyền (ACL): Yêu cầu role ADMIN.

Query Params: ?page=1&limit=20

Response:

{
  "success": true,
  "data": [
    { "id": "uid_1", "email": "admin@test.com", "roles": ["ADMIN"] },
    { "id": "uid_2", "email": "user@test.com", "roles": ["USER"] }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2
  }
}


PUT /api/v1/users/:id/role

Mô tả: Cập nhật Role cho một User cụ thể. Lưu ý: API này ở BE phải xử lý xóa Cache Redis của user đó.

Quyền (ACL): Yêu cầu role ADMIN.

Request Body:

{
  "roles": ["ADMIN", "USER"]
}


Response:

{
  "success": true,
  "data": {
    "message": "Cập nhật quyền thành công."
  }
}


---

## 3. Chat API

Auth: tất cả endpoints yêu cầu `Authorization: Bearer <Firebase ID Token>`.

### 3.1. Rooms

#### GET /api/chat/rooms
Lấy danh sách tất cả rooms. Response kèm trạng thái `isMember`, `isOwner` và `lastMessage` của mỗi room.

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "room-uuid",
      "name": "General",
      "isOwner": true,
      "isMember": true,
      "lastMessage": {
        "content": "Hello",
        "createdAt": "2026-03-21T10:00:00.000Z"
      }
    }
  ]
}
```

#### POST /api/chat/rooms
Tạo room mới. Creator tự động được add làm member đầu tiên.

Request Body:
```json
{ "name": "Room Name" }
```

Response `201`:
```json
{
  "success": true,
  "data": { "id": "room-uuid", "name": "Room Name", "isOwner": true, "isMember": true, "lastMessage": null }
}
```

Errors: `400 VALIDATION_ERROR` (thiếu name)

#### POST /api/chat/rooms/:roomId/join
Tham gia room.

Response:
```json
{
  "success": true,
  "data": { "id": "msg-uuid", "roomId": "room-uuid", "type": "SYSTEM", "senderId": null, "content": "Alice đã tham gia room", "createdAt": "..." }
}
```

Errors: `404 ROOM_NOT_FOUND`, `409 ALREADY_MEMBER`

#### POST /api/chat/rooms/:roomId/leave
Rời room. Creator không thể leave nếu còn member khác.

Response: SYSTEM message tương tự join.

Errors: `404 ROOM_NOT_FOUND`, `403 NOT_MEMBER`, `403 CREATOR_CANNOT_LEAVE`

#### PATCH /api/chat/rooms/:roomId
Đổi tên room. Chỉ creator.

Request Body:
```json
{ "name": "New Name" }
```

Response:
```json
{ "success": true, "data": { "id": "room-uuid", "name": "New Name" } }
```

Errors: `404 ROOM_NOT_FOUND`, `403 FORBIDDEN`, `400 VALIDATION_ERROR`

#### DELETE /api/chat/rooms/:roomId
Soft delete room. Chỉ creator.

Response:
```json
{ "success": true, "data": null }
```

Errors: `404 ROOM_NOT_FOUND`, `403 FORBIDDEN`

#### POST /api/chat/rooms/:roomId/members
Thêm member vào room. Chỉ creator.

Request Body:
```json
{ "userId": "target-firebase-uid" }
```

Response:
```json
{ "success": true, "data": null }
```

Errors: `400 VALIDATION_ERROR`, `404 ROOM_NOT_FOUND`, `404 USER_NOT_FOUND`, `403 FORBIDDEN`, `409 ALREADY_MEMBER`

### 3.2. Messages

#### GET /api/chat/rooms/:roomId/messages
Lấy lịch sử tin nhắn. Hỗ trợ cursor-based pagination và fetch missed messages.

Query Params:
| Param | Mô tả |
|---|---|
| `before` | messageId — lấy messages có id < before (load more) |
| `since` | ISO timestamp — lấy messages sau thời điểm này (fetch missed khi reconnect WS) |
| `limit` | Số lượng tối đa (default: 50, max: 100) |

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-uuid",
      "roomId": "room-uuid",
      "type": "USER",
      "senderId": "firebase-uid",
      "senderName": "Alice",
      "content": "Hello",
      "createdAt": "2026-03-21T10:00:00.000Z"
    }
  ],
  "meta": { "nextCursor": "msg-uuid-of-last-item-or-null" }
}
```

---

## 4. WebSocket Protocol (Gateway)

Endpoint: `ws://gateway:8080?token=<Firebase ID Token>`

Auth: Token được verify khi connect. Kết nối bị đóng nếu token invalid/expired.

### Client → Gateway (frames gửi lên)

#### Message
```json
{ "type": "message", "roomId": "room-uuid", "content": "Hello" }
```

#### Ping (keepalive mỗi 30s)
```json
{ "type": "ping" }
```

### Gateway → Client (frames nhận về)

#### Message (broadcast từ room)
```json
{
  "type": "message",
  "data": {
    "id": "msg-uuid",
    "roomId": "room-uuid",
    "type": "USER",
    "senderId": "firebase-uid",
    "senderName": "Alice",
    "content": "Hello",
    "createdAt": "2026-03-21T10:00:00.000Z"
  }
}
```

#### Pong
```json
{ "type": "pong" }
```

#### Error
```json
{ "type": "error", "code": "INTERNAL_ERROR", "messageId": "msg-uuid" }
```

Error codes: `DELIVER_FAILED`, `INVALID_PAYLOAD`, `INTERNAL_ERROR`

### Close Codes

| Code | Nghĩa | FE nên xử lý |
|---|---|---|
| `4001` | Token invalid | Redirect `/login`, không reconnect |
| `4002` | Token expired | Refresh Firebase token → reconnect |
| `4003` | Duplicate connection | Không reconnect |
| `1001` | Gateway restart | Reconnect với exponential backoff |

---

## 5. Internal API (Gateway → Instance)

> Chỉ dùng nội bộ. Nginx block path `/internal` từ bên ngoài (return 403).
> Không có auth middleware — bảo vệ bằng network isolation.

#### POST /internal/ws/connect
Gateway gọi khi user connect WS thành công.

Request Body:
```json
{ "userId": "firebase-uid", "connId": "uuid", "gatewayUrl": "http://gateway:8080" }
```

Response: `{ "ok": true }`

#### POST /internal/ws/message
Gateway forward message từ WS client. Instance persist DB và broadcast.

Request Body:
```json
{ "from": "firebase-uid", "roomId": "room-uuid", "content": "Hello" }
```

Response:
```json
{ "ok": true, "data": { "messageId": "msg-uuid", "deliveredCount": 2 } }
```

#### POST /internal/ws/disconnect
Gateway gọi khi user đóng WS.

Request Body:
```json
{ "userId": "firebase-uid", "connId": "uuid" }
```

Response: `{ "ok": true }`

---

## 6. Gateway Deliver API (Instance → Gateway)

> Instance gọi trực tiếp vào Gateway URL lấy từ Redis (không qua Nginx).

#### POST /deliver
Push payload tới một WS connection cụ thể.

Request Body:
```json
{ "connId": "uuid", "payload": { "type": "message", "data": { ... } } }
```

Response:
- `200` `{ "success": true }` — ws.send() thành công
- `404` `{ "success": false, "error": "CONN_NOT_FOUND" }` — connId không còn trong registry

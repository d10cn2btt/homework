# API Contracts: REST Endpoints

**Ngày**: 2026-03-07 | **Base URL**: `/api`
**Auth**: Mọi endpoint (trừ ghi chú) yêu cầu header `Authorization: Bearer <FIREBASE_ID_TOKEN>`

---

## Quy Ước Chung

### Request Headers
```
Authorization: Bearer <FIREBASE_ID_TOKEN>   (bắt buộc với mọi endpoint được bảo vệ)
Content-Type: application/json
```

### Error Response Format
```json
{
  "message": "Mô tả lỗi thân thiện với người dùng"
}
```

### HTTP Status Codes
| Code | Ý nghĩa |
|------|---------|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Dữ liệu đầu vào không hợp lệ |
| 401 | Chưa xác thực (thiếu/hết hạn token) |
| 403 | Không có quyền |
| 404 | Không tìm thấy tài nguyên |
| 409 | Xung đột (ví dụ: email đã tồn tại) |
| 500 | Lỗi server (không để lộ chi tiết nội bộ) |

---

## 1. Authentication / Profile Sync

### POST /api/auth/sync
Đồng bộ Firebase user vào DB khi đăng nhập lần đầu. Gọi sau `signInWithEmailAndPassword` thành công ở client.

**Auth**: Bắt buộc (auth middleware)
**Role**: Bất kỳ user đã xác thực

**Response 200** (user đã tồn tại):
```json
{
  "id": "firebase-uid-abc123",
  "email": "user@example.com",
  "display_name": "Nguyễn Văn A",
  "status": "ACTIVE",
  "roles": ["USER"]
}
```

**Response 201** (user mới — tạo profile + gán role USER):
```json
{
  "id": "firebase-uid-abc123",
  "email": "user@example.com",
  "display_name": "user",
  "status": "ACTIVE",
  "roles": ["USER"]
}
```

---

## 2. Profile (người dùng hiện tại)

### GET /api/me
Lấy thông tin hồ sơ cá nhân.

**Auth**: Bắt buộc | **Role**: Bất kỳ

**Response 200**:
```json
{
  "id": "firebase-uid-abc123",
  "email": "user@example.com",
  "display_name": "Nguyễn Văn A",
  "status": "ACTIVE",
  "roles": ["USER"],
  "created_at": "2026-03-07T10:00:00.000Z"
}
```

---

### PUT /api/me
Cập nhật tên hiển thị cá nhân.

**Auth**: Bắt buộc | **Role**: Bất kỳ

**Request Body**:
```json
{
  "display_name": "Tên Mới"
}
```

**Validation**:
- `display_name`: required, string, 1–100 ký tự

**Response 200**:
```json
{
  "id": "firebase-uid-abc123",
  "display_name": "Tên Mới",
  "updated_at": "2026-03-07T11:00:00.000Z"
}
```

---

## 3. Posts

### GET /api/posts
Lấy danh sách bài post (phân trang, tìm kiếm theo tiêu đề).

**Auth**: Bắt buộc | **Role**: Bất kỳ

**Query Parameters**:
| Param | Kiểu | Mặc định | Mô tả |
|-------|------|---------|-------|
| `page` | number | 1 | Trang hiện tại |
| `limit` | number | 10 | Số bài mỗi trang (max: 50) |
| `search` | string | "" | Tìm kiếm theo tiêu đề (contains, case-insensitive) |

**Response 200**:
```json
{
  "posts": [
    {
      "id": 1,
      "title": "Hello World",
      "author": {
        "id": "firebase-uid-abc123",
        "display_name": "Nguyễn Văn A"
      },
      "created_at": "2026-03-07T10:00:00.000Z",
      "updated_at": "2026-03-07T10:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 5
}
```

> Khi tác giả bị xóa: `"author": { "id": null, "display_name": "Người dùng đã xóa" }`

---

### POST /api/posts
Tạo bài post mới.

**Auth**: Bắt buộc | **Role**: Bất kỳ (USER hoặc ADMIN)

**Request Body**:
```json
{
  "title": "Tiêu đề bài viết",
  "content": "Nội dung bài viết..."
}
```

**Validation**:
- `title`: required, string, 1–255 ký tự (sau trim)
- `content`: required, string, min 1 ký tự (sau trim)

**Response 201**:
```json
{
  "id": 42,
  "title": "Tiêu đề bài viết",
  "content": "Nội dung bài viết...",
  "author_id": "firebase-uid-abc123",
  "created_at": "2026-03-07T10:00:00.000Z",
  "updated_at": "2026-03-07T10:00:00.000Z"
}
```

---

### GET /api/posts/:id
Lấy chi tiết một bài post.

**Auth**: Bắt buộc | **Role**: Bất kỳ

**Response 200**:
```json
{
  "id": 42,
  "title": "Tiêu đề bài viết",
  "content": "Nội dung bài viết...",
  "author": {
    "id": "firebase-uid-abc123",
    "display_name": "Nguyễn Văn A"
  },
  "created_at": "2026-03-07T10:00:00.000Z",
  "updated_at": "2026-03-07T10:00:00.000Z"
}
```

**Response 404** nếu không tìm thấy.

---

### PUT /api/posts/:id
Cập nhật bài post.

**Auth**: Bắt buộc | **Quyền**: Tác giả của bài hoặc ADMIN

**Request Body**:
```json
{
  "title": "Tiêu đề mới",
  "content": "Nội dung mới..."
}
```

**Validation**: Giống POST /api/posts

**Response 200**: Giống GET /api/posts/:id (dữ liệu sau update)

**Response 403** nếu không phải tác giả và không phải ADMIN.
**Response 404** nếu bài post không tồn tại.

---

### DELETE /api/posts/:id
Xóa bài post.

**Auth**: Bắt buộc | **Quyền**: Tác giả của bài hoặc ADMIN

**Response 200**:
```json
{ "message": "Đã xóa bài post thành công" }
```

**Response 403** nếu không phải tác giả và không phải ADMIN.
**Response 404** nếu bài post không tồn tại.

---

## 4. Users (Admin only)

> Mọi endpoint trong section này yêu cầu role **ADMIN**.

### GET /api/users
Lấy danh sách người dùng (phân trang).

**Query Parameters**:
| Param | Kiểu | Mặc định |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 10 |

**Response 200**:
```json
{
  "users": [
    {
      "id": "firebase-uid-abc123",
      "email": "user@example.com",
      "display_name": "Nguyễn Văn A",
      "status": "ACTIVE",
      "roles": ["USER"],
      "created_at": "2026-03-07T10:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "totalPages": 3
}
```

---

### POST /api/users
Tạo tài khoản người dùng mới (Admin tạo thủ công).

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "display_name": "Người Dùng Mới",
  "password": "initialPassword123"
}
```

**Validation**:
- `email`: required, valid email format
- `display_name`: required, 1–100 ký tự
- `password`: required, min 6 ký tự (Firebase requirement)

**Response 201**:
```json
{
  "id": "firebase-uid-new123",
  "email": "newuser@example.com",
  "display_name": "Người Dùng Mới",
  "status": "ACTIVE",
  "roles": ["USER"]
}
```

**Response 409** nếu email đã tồn tại.

---

### GET /api/users/:id
Lấy chi tiết một người dùng.

**Response 200**:
```json
{
  "id": "firebase-uid-abc123",
  "email": "user@example.com",
  "display_name": "Nguyễn Văn A",
  "status": "ACTIVE",
  "roles": ["USER"],
  "created_at": "2026-03-07T10:00:00.000Z",
  "updated_at": "2026-03-07T10:00:00.000Z"
}
```

**Response 404** nếu không tìm thấy.

---

### PUT /api/users/:id
Cập nhật tên hiển thị và/hoặc trạng thái người dùng.

**Request Body** (tất cả optional, ít nhất 1):
```json
{
  "display_name": "Tên Mới",
  "status": "INACTIVE"
}
```

**Validation**:
- `display_name`: optional, 1–100 ký tự
- `status`: optional, phải là `ACTIVE` hoặc `INACTIVE`

**Ràng buộc**: Không cho vô hiệu hóa Admin cuối cùng.

**Response 200**: Giống GET /api/users/:id

**Response 400** nếu cố vô hiệu hóa Admin cuối cùng.

---

### DELETE /api/users/:id
Xóa hoàn toàn tài khoản người dùng (hard delete).

**Hành vi**: Bài post của user được giữ lại, `author_id` set thành `NULL`.

**Ràng buộc**: Không cho xóa Admin cuối cùng.

**Response 200**:
```json
{ "message": "Đã xóa tài khoản người dùng thành công" }
```

**Response 400** nếu cố xóa Admin cuối cùng.

---

### PATCH /api/users/:id/role
Thay đổi vai trò của người dùng.

**Request Body**:
```json
{
  "role": "ADMIN"
}
```

**Validation**:
- `role`: required, phải là `ADMIN` hoặc `USER`

**Hành vi**:
1. Cập nhật `user_roles` trong DB
2. Xóa `user:roles:{id}` trong Redis (đồng bộ)
3. Ghi security log (event: role_changed)

**Ràng buộc**: Không cho hạ cấp Admin cuối cùng.

**Response 200**:
```json
{
  "id": "firebase-uid-abc123",
  "roles": ["ADMIN"],
  "updated_at": "2026-03-07T11:00:00.000Z"
}
```

**Response 400** nếu cố hạ cấp Admin cuối cùng.

---

## 5. Middleware Execution Order

```
Request
  │
  ▼
auth.mdw.js      ← verify Firebase token, set req.user.uid
  │
  ▼
acl.mdw.js       ← load roles (Redis → DB fallback), set req.user.roles
  │              ← check role requirement for route
  ▼
controller       ← ownership check (nếu cần, e.g. PUT/DELETE /posts/:id)
  │
  ▼
service          ← DB/Redis operations
```

---

## 6. ACL Matrix

| Endpoint | Phương thức | USER | ADMIN |
|----------|-------------|------|-------|
| /api/auth/sync | POST | ✅ | ✅ |
| /api/me | GET, PUT | ✅ | ✅ |
| /api/posts | GET | ✅ | ✅ |
| /api/posts | POST | ✅ | ✅ |
| /api/posts/:id | GET | ✅ | ✅ |
| /api/posts/:id | PUT | ✅ (chỉ bài của mình) | ✅ (mọi bài) |
| /api/posts/:id | DELETE | ✅ (chỉ bài của mình) | ✅ (mọi bài) |
| /api/users | GET | ❌ | ✅ |
| /api/users | POST | ❌ | ✅ |
| /api/users/:id | GET | ❌ | ✅ |
| /api/users/:id | PUT | ❌ | ✅ |
| /api/users/:id | DELETE | ❌ | ✅ |
| /api/users/:id/role | PATCH | ❌ | ✅ |

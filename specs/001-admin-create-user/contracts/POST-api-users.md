# Contract: POST /api/users

**Tính năng**: Tạo người dùng mới (Admin only)
**Route**: `POST /api/users`
**Auth**: Bearer token (Firebase ID Token) — ADMIN role required

## Request

### Headers

```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

### Body

```json
{
  "email": "user@example.com",
  "display_name": "Nguyễn Văn A",
  "password": "matkhau123"
}
```

| Trường | Kiểu | Bắt buộc | Ràng buộc |
|--------|------|----------|-----------|
| email | string | Có | Định dạng email hợp lệ, chưa tồn tại |
| display_name | string | Không | Tối đa 100 ký tự; nếu bỏ trống dùng phần trước @ của email |
| password | string | Có | Tối thiểu 6 ký tự |

## Responses

### 201 Created — Thành công

```json
{
  "id": "firebase-uid-abc123",
  "email": "user@example.com",
  "display_name": "Nguyễn Văn A",
  "status": "ACTIVE",
  "roles": ["USER"],
  "created_at": "2026-03-08T10:00:00.000Z"
}
```

### 400 Bad Request — Input không hợp lệ

```json
{ "message": "email, password là bắt buộc" }
```

```json
{ "message": "Mật khẩu phải có ít nhất 6 ký tự" }
```

### 401 Unauthorized — Token không hợp lệ hoặc thiếu

```json
{ "message": "Unauthorized" }
```

### 403 Forbidden — Không phải ADMIN

```json
{ "message": "Forbidden" }
```

### 409 Conflict — Email đã tồn tại

```json
{ "message": "Email đã tồn tại" }
```

### 500 Internal Server Error — Lỗi tạo tài khoản (đã rollback Firebase)

```json
{ "message": "Không thể tạo tài khoản. Vui lòng thử lại." }
```

## Behavior notes

- Firebase account được tạo trước; nếu DB insert thất bại, Firebase account bị xóa (rollback).
- Tài khoản mới luôn có vai trò USER; không thể chỉ định vai trò khác qua endpoint này.
- Tài khoản được tạo với trạng thái ACTIVE.

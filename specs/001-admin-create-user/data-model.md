# Data Model: Màn hình tạo người dùng mới cho Admin

**Branch**: `001-admin-create-user` | **Date**: 2026-03-08

## Entities liên quan

Tính năng này không tạo entity mới. Nó sử dụng các entity hiện có trong schema.

### User (đã tồn tại)

| Cột | Kiểu | Ràng buộc | Ghi chú |
|-----|------|-----------|---------|
| id | String | PK, unique | Firebase UID |
| email | String | unique, NOT NULL | Email đăng nhập |
| display_name | String | nullable | Tên hiển thị; mặc định = phần trước @ nếu null |
| status | Enum(ACTIVE, INACTIVE) | NOT NULL, default ACTIVE | Trạng thái tài khoản |
| created_at | DateTime | NOT NULL, default now() | Thời điểm tạo |

### Role (đã tồn tại)

| Cột | Kiểu | Ràng buộc |
|-----|------|-----------|
| id | Int | PK |
| name | String | unique — 'ADMIN' hoặc 'USER' |

### UserRole (đã tồn tại)

| Cột | Kiểu | Ràng buộc |
|-----|------|-----------|
| user_id | String | FK → User.id |
| role_id | Int | FK → Role.id |

## Luồng dữ liệu khi tạo người dùng

```
Client (Admin)
  → POST /api/users { email, display_name?, password }
    → firebase.auth().createUser() → returns { uid }
    → prisma.user.create({ id: uid, email, display_name, status: ACTIVE })
    → prisma.userRole.create({ user_id: uid, role_id: <USER role id> })
    ↓ [nếu DB thất bại]
    → firebase.auth().deleteUser(uid)  ← ROLLBACK
    → throw error → 500 response
  ← 201 { id, email, display_name, status, roles: ['USER'] }
```

## Display name default logic

```
display_name = input.display_name?.trim() || email.split('@')[0]
```

Áp dụng ở tầng service, trước khi gọi Firebase và DB.

## Không có schema migration cần thiết

Schema hiện có đã đủ. Tính năng chỉ thêm một record vào bảng `users` và một record vào `user_roles`.

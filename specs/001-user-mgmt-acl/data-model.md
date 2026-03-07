# Data Model: Quản lý User & ACL & Posts

**Ngày**: 2026-03-07 | **ORM**: Prisma 5 | **DB**: PostgreSQL 15

---

## Entities Overview

```
users ──────< user_roles >────── roles
  │
  └──────< posts
```

- Một `user` có nhiều `user_roles` (thực tế chỉ 1 role, nhưng bảng junction giữ thiết kế linh hoạt)
- Một `role` có nhiều `user_roles`
- Một `user` có nhiều `posts`
- Một `post` thuộc về 0 hoặc 1 `user` (nullable khi user bị hard delete)

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

enum RoleName {
  ADMIN
  USER
}

model User {
  id           String     @id                    // Firebase UID
  email        String     @unique
  display_name String
  status       UserStatus @default(ACTIVE)
  created_at   DateTime   @default(now())
  updated_at   DateTime   @updatedAt

  user_roles   UserRole[]
  posts        Post[]

  @@index([status])
}

model Role {
  id         Int        @id @default(autoincrement())
  name       RoleName   @unique

  user_roles UserRole[]
}

model UserRole {
  user_id String
  role_id Int

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
  role Role @relation(fields: [role_id], references: [id])

  @@id([user_id, role_id])
  @@index([user_id])
}

model Post {
  id         Int      @id @default(autoincrement())
  title      String
  content    String   @db.Text
  author_id  String?                              // NULL = "Người dùng đã xóa"
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  author User? @relation(fields: [author_id], references: [id], onDelete: SetNull)

  @@index([author_id])
  @@index([created_at(sort: Desc)])
}
```

---

## Mô Tả Thực Thể Chi Tiết

### User

| Trường | Kiểu | Ràng buộc | Ghi chú |
|--------|------|-----------|---------|
| `id` | String (PK) | NOT NULL, UNIQUE | Firebase UID — do Firebase cung cấp, không tự sinh |
| `email` | String | NOT NULL, UNIQUE | Bất biến sau khi tạo; không cho phép update qua API |
| `display_name` | String | NOT NULL | Mặc định = phần trước `@` của email khi auto-create |
| `status` | Enum | NOT NULL, default ACTIVE | `ACTIVE` hoặc `INACTIVE` (soft delete) |
| `created_at` | DateTime | auto | Ghi khi tạo |
| `updated_at` | DateTime | auto | Cập nhật tự động khi có thay đổi |

**Ràng buộc nghiệp vụ**:
- Mỗi user có đúng 1 `UserRole` tại một thời điểm
- `status = INACTIVE` → không thể login (check trong `auth.mdw.js` sau khi verify token)
- Không cho phép thay đổi email qua API của ứng dụng
- Admin cuối cùng không được hạ cấp/vô hiệu hóa (check trong `roles.service.js`)

### Role

| Trường | Kiểu | Ràng buộc | Ghi chú |
|--------|------|-----------|---------|
| `id` | Int (PK) | AUTO | |
| `name` | Enum | NOT NULL, UNIQUE | `ADMIN` hoặc `USER` |

**Seed data** (bắt buộc):
```sql
INSERT INTO "Role" (name) VALUES ('ADMIN'), ('USER');
```

### UserRole

| Trường | Kiểu | Ràng buộc | Ghi chú |
|--------|------|-----------|---------|
| `user_id` | String (FK) | NOT NULL | Cascade delete khi User bị xóa |
| `role_id` | Int (FK) | NOT NULL | |

**Composite PK**: `(user_id, role_id)`

**Ràng buộc nghiệp vụ**:
- Khi thay đổi role: xóa bản ghi cũ, tạo bản ghi mới (không update)
- Sau thay đổi: xóa `user:roles:{user_id}` trong Redis (đồng bộ, cùng transaction)

### Post

| Trường | Kiểu | Ràng buộc | Ghi chú |
|--------|------|-----------|---------|
| `id` | Int (PK) | AUTO | |
| `title` | String | NOT NULL, non-empty | Validate: min 1 ký tự sau trim |
| `content` | Text | NOT NULL, non-empty | Validate: min 1 ký tự sau trim |
| `author_id` | String? (FK) | NULLABLE | `NULL` = user đã bị hard delete; hiển thị "Người dùng đã xóa" |
| `created_at` | DateTime | auto | Dùng cho sort mặc định (DESC) |
| `updated_at` | DateTime | auto | |

**Ràng buộc nghiệp vụ**:
- Chỉ tác giả (`author_id = req.user.uid`) hoặc ADMIN mới sửa/xóa
- Khi `author_id = NULL`, bài post vẫn hiển thị trong danh sách; tên tác giả = "Người dùng đã xóa"
- Bài post không có trạng thái — công khai ngay sau khi tạo
- Sắp xếp mặc định: `created_at DESC`
- Tìm kiếm: `title ILIKE '%keyword%'` (case-insensitive contains)

---

## Redis Schema

| Key Pattern | Value | TTL | Mô tả |
|-------------|-------|-----|-------|
| `user:roles:{uid}` | JSON array of role names, e.g. `["ADMIN"]` | 3600s | Cache roles của user; xóa ngay khi role thay đổi |

**Ví dụ**:
```
KEY:   user:roles:abc123xyz
VALUE: ["ADMIN"]
TTL:   3600
```

---

## State Transitions

### User Status

```
(tạo mới)
    │
    ▼
 ACTIVE ──[Admin vô hiệu hóa]──► INACTIVE
    ▲                                │
    └──────[Admin kích hoạt lại]─────┘
    │
    ▼
 DELETED (hard delete — record bị xóa, posts giữ lại với author_id = NULL)
```

### Role của User

```
USER ──[Admin PATCH /role]──► ADMIN
ADMIN ──[Admin PATCH /role]──► USER
(Không cho phép nếu là Admin cuối cùng)
Sau mỗi thay đổi: xóa Redis cache user:roles:{uid}
```

### Post Lifecycle

```
(tạo) → PUBLISHED (ngay lập tức, không có trạng thái trung gian)
       → [tác giả/admin sửa] → PUBLISHED (updated)
       → [tác giả/admin xóa] → DELETED (hard delete)
```

---

## Validation Rules (API layer)

| Trường | Quy tắc |
|--------|---------|
| `display_name` (User create/update) | Non-empty string, max 100 ký tự |
| `email` (User create) | Định dạng email hợp lệ |
| `title` (Post create/update) | Non-empty string, max 255 ký tự |
| `content` (Post create/update) | Non-empty string |
| `role` (Role assignment) | Phải là `ADMIN` hoặc `USER` |
| `status` (User update) | Phải là `ACTIVE` hoặc `INACTIVE` |

---

## Database Indexes

```prisma
@@index([status])         -- User: lọc theo trạng thái
@@index([user_id])        -- UserRole: lookup nhanh roles của user
@@index([author_id])      -- Post: lọc theo tác giả
@@index([created_at(sort: Desc)])  -- Post: sort mặc định
```

**Index bổ sung** (chạy migration riêng nếu cần):
```sql
-- Full-text search cho post title (nếu dùng PostgreSQL trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX post_title_trgm_idx ON "Post" USING gin (title gin_trgm_ops);
```
> Ghi chú: ILIKE với index GIN trigram cho search performance tốt hơn khi dataset lớn. Với dataset nhỏ, ILIKE thông thường đủ dùng.

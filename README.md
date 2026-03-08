# Homework — CRUD App with User Management & ACL

Ứng dụng web full-stack với hệ thống quản lý người dùng, phân quyền theo role (RBAC), và xác thực qua Firebase Authentication.

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React (Vite) + React Router |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis (ioredis) |
| Auth | Firebase Authentication |
| Infrastructure | Docker (PostgreSQL + Redis) |

---

## Điểm nổi bật về kỹ thuật

### 1. Firebase Auth — không tự quản lý password
Backend **không bao giờ nhìn thấy password** của user. Firebase lo toàn bộ việc hash, lưu trữ, và verify. Backend chỉ nhận Firebase ID Token (JWT) và verify bằng Admin SDK.

### 2. Redis cache cho roles — invalidation ngay lập tức
Mỗi request cần kiểm tra role đều tra Redis trước (`user:roles:{uid}`, TTL 1 giờ). Cache miss mới query DB. Khi admin thay đổi role của một user, cache bị xóa **ngay lập tức** — user đó sẽ nhận role mới ở request tiếp theo, không cần chờ TTL hết hạn.

### 3. Auto-sync user lên DB khi login lần đầu
Khi user đăng nhập, frontend gọi `POST /api/auth/sync`. Backend tự động tạo user trong DB (nếu chưa có) và gán role `USER` mặc định — không cần form đăng ký riêng.

### 4. Last-admin guard
Hệ thống ngăn chặn tình trạng không còn admin nào:
- Không thể **xóa** admin cuối cùng
- Không thể **vô hiệu hóa** admin cuối cùng
- Không thể **hạ cấp** admin cuối cùng xuống USER

### 5. Vô hiệu hóa tài khoản real-time
Khi admin set user về `INACTIVE`, user đó bị chặn ở mọi API request tiếp theo — dù token Firebase vẫn còn hạn.

---

## Setup

### Yêu cầu
- Node.js 18+
- Docker Desktop

### 1. Clone và cài dependencies

```bash
git clone <repo-url>
cd homework

cd backend && npm install
cd ../frontend && npm install
```

### 2. Khởi động PostgreSQL + Redis

```bash
docker compose up -d
```

### 3. Cấu hình Firebase

**Lấy Service Account (cho Backend):**
1. Firebase Console → Project Settings → Service accounts
2. Generate new private key → tải file JSON
3. Đổi tên thành `firebase-service-account.json`, đặt vào thư mục `backend/`

**Lấy Web Config (cho Frontend):**
1. Firebase Console → Project Settings → General → Your apps → Add app (Web)
2. Copy config

**Tạo file .env:**

```bash
# Backend
cp backend/.env.example backend/.env
# Không cần sửa gì nếu dùng docker compose mặc định

# Frontend
cp frontend/.env.example frontend/.env
# Điền các giá trị Firebase vào frontend/.env
```

`frontend/.env`:
```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_APP_ID="..."
VITE_API_BASE_URL="http://localhost:3000/api"
```

### 4. Bật Email/Password trên Firebase

Firebase Console → Authentication → Sign-in method → **Email/Password** → Enable

### 5. Chạy migration và seed

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

Seed tạo 2 roles: `ADMIN` và `USER`.

### 6. Tạo tài khoản Admin đầu tiên

**Bước 1:** Firebase Console → Authentication → Users → **Add user** → nhập email + password → copy **UID** sinh ra

**Bước 2:** Chạy lệnh SQL (qua `npx prisma studio` hoặc psql):
```sql
INSERT INTO "User" (id, email, display_name, status, created_at, updated_at)
VALUES ('<UID>', 'admin@example.com', 'Admin', 'ACTIVE', NOW(), NOW());

INSERT INTO "UserRole" (user_id, role_id)
VALUES ('<UID>', 1);  -- role_id 1 = ADMIN
```

### 7. Chạy ứng dụng

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:3000/api

---

## Flow hoạt động

### Đăng nhập

```
User nhập email/pass
  → Firebase JS SDK xác thực, trả về ID Token
  → Frontend gọi POST /api/auth/sync (kèm token)
  → Backend verify token → tạo/tìm user trong DB → trả về thông tin + roles
  → Frontend lưu vào AuthContext
```

### Mỗi API request

```
Request kèm Authorization: Bearer <token>
  → auth.mdw.js: verify token với Firebase Admin SDK
  → Kiểm tra user có INACTIVE trong DB không
  → acl.mdw.js: lấy roles từ Redis (hoặc DB nếu cache miss)
  → Cho phép hoặc từ chối (403)
```

### Tính năng theo role

| Tính năng | USER | ADMIN |
|---|:---:|:---:|
| Xem/tạo/sửa/xóa bài viết của mình | ✓ | ✓ |
| Sửa profile | ✓ | ✓ |
| Xem danh sách tất cả users | | ✓ |
| Tạo user mới | | ✓ |
| Sửa thông tin user | | ✓ |
| Vô hiệu hóa/kích hoạt user | | ✓ |
| Thay đổi role của user | | ✓ |
| Xóa user | | ✓ |

### Admin tạo user mới

Admin điền email + display name + password → Backend tạo user trên **Firebase trước**, lấy UID → tạo bản ghi trong DB với role `USER` mặc định → Admin có thể vào trang chi tiết user để nâng lên `ADMIN` nếu cần.

---

## API Endpoints

```
POST   /api/auth/sync          — Sync Firebase user vào DB

GET    /api/profile            — Xem profile của mình
PUT    /api/profile            — Sửa display name

GET    /api/users              — [ADMIN] Danh sách users (có phân trang)
POST   /api/users              — [ADMIN] Tạo user mới
GET    /api/users/:id          — [ADMIN] Chi tiết user
PUT    /api/users/:id          — [ADMIN] Sửa display name / status
DELETE /api/users/:id          — [ADMIN] Xóa user
PATCH  /api/users/:id/role     — [ADMIN] Thay đổi role

GET    /api/posts              — Danh sách bài viết
POST   /api/posts              — Tạo bài viết
GET    /api/posts/:id          — Chi tiết bài viết
PUT    /api/posts/:id          — Sửa bài viết
DELETE /api/posts/:id          — Xóa bài viết
```

---

## Cấu trúc thư mục

```
homework/
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # DB schema (User, Role, UserRole, Post)
│   │   └── seed.js            # Tạo roles ADMIN & USER
│   └── src/
│       ├── config/            # Firebase Admin, DB, Redis init
│       ├── middlewares/
│       │   ├── auth.mdw.js    # Verify Firebase token
│       │   └── acl.mdw.js     # Kiểm tra role (Redis-backed)
│       ├── services/
│       │   ├── cache.service.js  # Redis get/set/del roles
│       │   ├── users.service.js
│       │   ├── roles.service.js
│       │   └── posts.service.js
│       ├── controllers/
│       └── routes/
└── frontend/
    └── src/
        ├── config/firebase.js    # Firebase Client SDK init
        ├── contexts/AuthContext  # Global auth state + roles
        ├── api/axios.js          # Auto-attach Bearer token
        ├── components/
        │   ├── ProtectedRoute    # Redirect về /login nếu chưa auth
        │   └── AdminRoute        # Redirect về /403 nếu không phải ADMIN
        └── pages/
```

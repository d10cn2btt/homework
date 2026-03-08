# Implementation Plan

Thứ tự implement theo dependency: Infrastructure → BE Foundation → BE Features → FE Foundation → FE Features.

---

## Phase 0 — Infrastructure & Project Bootstrap

### Task 0.1 — Docker Compose (local dev)
- Tạo `docker-compose.yml` ở root với services:
  - `postgres`: image `postgres:16`, port `5432`, volume để persist data
  - `redis`: image `redis:7-alpine`, port `6379`
- Tạo `.env.example` cho cả BE và FE

```
# docker-compose.yml services:
postgres:
  image: postgres:16
  environment:
    POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
  ports: 5432:5432
  volumes: postgres_data:/var/lib/postgresql/data

redis:
  image: redis:7-alpine
  ports: 6379:6379
```

**Deliverable**: `docker compose up -d` → Postgres + Redis chạy được

---

### Task 0.2 — Backend project init
- `cd backend && npm init -y`
- Install: `express`, `prisma`, `@prisma/client`, `firebase-admin`, `ioredis`, `dotenv`, `cors`
- Dev: `nodemon`
- Tạo cấu trúc thư mục theo specs
- Tạo `src/app.js` với express boilerplate + health check `GET /health`

### Task 0.3 — Frontend project init
- `npm create vite@latest frontend -- --template react`
- Install: `tailwindcss`, `axios`, `firebase`, `react-router-dom`
- Config Tailwind
- Xóa boilerplate mặc định của Vite

---

## Phase 1 — Backend Foundation

### Task 1.1 — Prisma Schema + Migration + Seed
File: `prisma/schema.prisma`
- Define models: `User`, `Role`, `UserRole`, `Post`
- Chú ý `UserRole` có `@@id([userId])` để enforce 1 user = 1 role
- Run: `npx prisma migrate dev --name init`
- Tạo `prisma/seed.js`: insert 2 roles (`ADMIN`, `USER`)
- Run: `npx prisma db seed`

### Task 1.2 — Config layer
- `src/config/db.js` — export Prisma client singleton
- `src/config/redis.js` — export ioredis client, log khi connect/error
- `src/config/firebase.js` — init Firebase Admin SDK từ service account (env var)

### Task 1.3 — role.service.js (Redis cache core)
Logic dùng cho `acl.mdw.js`:
```
getRoleFromCache(uid)     → redis.get(`user:roles:${uid}`)
setRoleToCache(uid, role) → redis.setex(`user:roles:${uid}`, 3600, role)
invalidateRoleCache(uid)  → redis.del(`user:roles:${uid}`)
getRoleFromDB(uid)        → prisma query user_roles join roles
```

### Task 1.4 — auth.mdw.js
- Lấy `Authorization: Bearer <token>` từ header
- Gọi `admin.auth().verifyIdToken(token)` → `req.user = { uid, email, name }`
- Nếu không có token hoặc invalid → 401

### Task 1.5 — acl.mdw.js
- Factory function: `requireRole(...roles)` → trả về middleware
- Flow: cache hit → dùng luôn / cache miss → query DB → set cache → check
- Nếu role không match → 403

---

## Phase 2 — Backend Features

### Task 2.1 — Auth Sync
`POST /api/auth/sync` (requires `auth.mdw.js` only)
- Service: upsert user vào DB theo `uid`
  - Nếu chưa có: INSERT user + gán role `USER`
  - Nếu đã có: UPDATE `email`, `display_name`
- Trả về user object + role

### Task 2.2 — Profile
`GET /api/profile` — trả về user info + role hiện tại
`PUT /api/profile` — update `display_name`, validate không được rỗng

### Task 2.3 — Posts
`GET /api/posts`
- Query: published posts của tất cả mọi người OR draft của chính `req.user.uid`
- Sort: `created_at DESC`

`GET /api/posts/:id`
- Nếu post là draft và `post.user_id !== req.user.uid` → 403

`POST /api/posts` — tạo mới, `user_id = req.user.uid`

`PUT /api/posts/:id`
- Check ownership: `post.user_id !== req.user.uid` → 403
- Update `title`, `content`, `status`

`DELETE /api/posts/:id`
- Check ownership → 403 nếu không phải chủ

### Task 2.4 — Users (Admin)
`GET /api/users` — list all users kèm role

`GET /api/users/:id` — detail 1 user

`POST /api/users`
- Tạo user trên Firebase Admin (`admin.auth().createUser(...)`)
- Insert vào DB + gán role `USER`

`PUT /api/users/:id` — update `display_name`, `status`

`DELETE /api/users/:id`
- Đếm số ADMIN hiện tại
- Nếu user là ADMIN và count = 1 → 400 "Cannot delete the last admin"
- Xóa user trên Firebase + xóa DB (cascade xóa user_roles, posts)

`PUT /api/users/:id/role`
- Update `user_roles`
- Gọi `invalidateRoleCache(uid)`

---

## Phase 3 — Frontend Foundation

### Task 3.1 — Firebase Client config
`src/config/firebase.js` — initializeApp từ env vars

### Task 3.2 — AuthContext
`src/contexts/AuthContext.jsx`
- `onAuthStateChanged` → lưu `currentUser`
- Sau khi Firebase login: gọi `POST /api/auth/sync` → lưu `userProfile` (có role)
- Export: `useAuth()` hook

### Task 3.3 — Axios instance
`src/api/axios.js`
- `baseURL = import.meta.env.VITE_API_URL`
- Request interceptor: tự động lấy `currentUser.getIdToken()` → gắn vào header
- Response interceptor: handle 401 → redirect login

### Task 3.4 — Router + Route Guards
`src/App.jsx`
- `PrivateRoute`: chưa login → redirect `/login`
- `AdminRoute`: không phải ADMIN → redirect `/`
- Định nghĩa tất cả routes theo specs

### Task 3.5 — Layout / Header
- Hiển thị `display_name`, avatar placeholder
- Nút logout (`signOut` Firebase)
- Link nav: Dashboard, My Posts, Profile
- Nếu role = ADMIN: hiển thị thêm link "User Management"

---

## Phase 4 — Frontend Features

### Task 4.1 — Login Page (`/login`)
- Form: email + password
- Gọi `signInWithEmailAndPassword` → AuthContext tự xử lý sync
- Error handling: sai credentials

### Task 4.2 — Dashboard (`/`)
- Gọi `GET /api/posts` → hiển thị danh sách published posts (title, tác giả, ngày)
- Click vào post → `/posts/:id`

### Task 4.3 — Post Detail (`/posts/:id`)
- Gọi `GET /api/posts/:id`
- Hiển thị title, content, status, tác giả

### Task 4.4 — My Posts (`/my-posts`)
- Hiển thị cả draft + published của chính mình
- Nút tạo mới → modal/form: title, content, status
- Inline actions: Edit, Delete

### Task 4.5 — Profile (`/profile`)
- Hiển thị email (read-only), display_name (editable), role
- Form submit → `PUT /api/profile`

### Task 4.6 — User Management (`/admin/users`)
- Bảng: email, display_name, role, status, actions
- Tạo user: modal form (email, password, display_name)
- Đổi role: dropdown inline
- Xóa: confirm dialog (hiển thị warning nếu xóa ADMIN)
- Disable/Enable: toggle status

---

## Thứ tự thực hiện (suggested)

```
0.1 Docker Compose
  └─ 0.2 BE init
  └─ 0.3 FE init
       └─ 1.1 Prisma Schema + Seed
            └─ 1.2 Config layer (db, redis, firebase)
                 └─ 1.3 role.service.js
                      └─ 1.4 auth.mdw.js
                           └─ 1.5 acl.mdw.js
                                └─ 2.1 Auth Sync  ←── test được luồng auth end-to-end
                                     └─ 2.2 Profile
                                     └─ 2.3 Posts
                                     └─ 2.4 Users (Admin)
                                          └─ 3.1 Firebase FE config
                                               └─ 3.2 AuthContext
                                                    └─ 3.3 Axios
                                                         └─ 3.4 Router
                                                              └─ 3.5 Layout
                                                                   └─ 4.1 Login
                                                                        └─ 4.2 Dashboard
                                                                        └─ 4.3 Post Detail
                                                                        └─ 4.4 My Posts
                                                                        └─ 4.5 Profile
                                                                        └─ 4.6 User Mgmt
```

---

## Environment Variables

### Backend `.env`
```
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
REDIS_URL=redis://localhost:6379
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
PORT=3000
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

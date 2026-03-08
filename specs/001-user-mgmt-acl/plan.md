# Kế Hoạch Triển Khai: Quản lý người dùng với ACL & CRUD bài post

**Nhánh**: `001-user-mgmt-acl` | **Ngày**: 2026-03-07 | **Đặc tả**: [spec.md](spec.md)
**Nguồn**: Đặc tả từ `specs/001-user-mgmt-acl/spec.md`

## Tóm tắt

Xây dựng ứng dụng web full-stack gồm: xác thực người dùng qua Firebase Authentication, CRUD bài post (mọi user tạo được, chỉ tác giả/admin sửa-xóa), quản lý tài khoản người dùng (Admin), và phân quyền dựa trên vai trò (ADMIN/USER) với Redis cache cho ACL middleware.

## Bối Cảnh Kỹ Thuật

**Language/Version**: Node.js 20 LTS (backend), React 18 (frontend)
**Style**: TailwindCss
**Primary Dependencies**: Express 4.18, Firebase Admin SDK 12, Prisma 5, ioredis 5, Axios 1.6, Firebase JS SDK 10, React Router 6, Vite 5
**ORM được chọn**: **Prisma** — type-safe schema, migration tự động, DX tốt nhất cho Node.js/Express
**Storage**: PostgreSQL 15 (qua Prisma)
**Cache**: Redis 7 — client `ioredis` (key: `user:roles:{uid}`, TTL: 3600s)
**Testing**: Jest + Supertest (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Web application — React SPA + REST API trên Linux server
**Project Type**: Web application (2 project: backend + frontend)
**Performance Goals**: p95 ≤ 200ms (CRUD endpoint), p95 ≤ 20ms ACL cache-hit, p95 ≤ 80ms ACL cache-miss
**Constraints**: Single-instance deployment, không có offline mode, Firebase Auth là identity provider duy nhất
**Scale/Scope**: Hàng chục đến hàng trăm user, hàng nghìn bài post

## Kiểm Tra Hiến Pháp

*GATE: Phải pass trước Phase 0 research. Kiểm tra lại sau Phase 1 design.*

| Nguyên Tắc | Trạng Thái | Ghi Chú |
|-----------|-----------|---------|
| I. Chất Lượng Code | PASS | File ≤300 dòng, hàm ≤40 dòng, không hardcode secrets, pin version dependencies |
| II. Tiêu Chuẩn Kiểm Thử | PASS | Jest+Supertest backend, Vitest+RTL frontend; auth.mdw + acl.mdw có unit test riêng; cache invalidation có integration test; coverage ≥ 80% middlewares + services |
| III. Nhất Quán UX | PASS | Loading state mọi async call, thông báo lỗi thân thiện, ẩn (không disable) UI theo role, validate form theo field |
| IV. Yêu Cầu Hiệu Năng | PASS | ioredis cho Redis; index trên `users.id`, `user_roles.user_id`; không N+1 query |
| V. Bảo Mật & ACL | PASS* | Firebase token verify phía server; ACL middleware trước mọi controller; **server-side security log** cho role changes (uid actor, uid target, role cũ, role mới, timestamp) qua structured logger — phân biệt với admin UI audit log (ngoài phạm vi) |

> **Lưu ý Nguyên Tắc V**: Constitution yêu cầu ghi log thay đổi role ở phía server (structured logging — không phải UI/DB audit trail). Spec clarification "audit log ngoài phạm vi" đề cập đến tính năng UI xem lịch sử; security log phía server vẫn được triển khai và là bắt buộc.

## Cấu Trúc Dự Án

### Tài liệu (tính năng này)

```text
specs/001-user-mgmt-acl/
├── plan.md              # File này
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api.md           # REST API endpoint contracts
└── tasks.md             # Phase 2 output (/speckit.tasks — chưa tạo)
```

### Source Code (thư mục gốc repo)

```text
backend/
├── src/
│   ├── config/
│   │   ├── db.js            # Prisma client singleton
│   │   ├── redis.js         # ioredis client singleton
│   │   └── firebase.js      # Firebase Admin SDK init
│   ├── middlewares/
│   │   ├── auth.mdw.js      # Verify Firebase ID Token → req.user
│   │   └── acl.mdw.js       # Load roles (Redis/DB) & check permission
│   ├── controllers/
│   │   ├── auth.controller.js    # POST /api/auth/sync
│   │   ├── posts.controller.js   # CRUD posts
│   │   ├── users.controller.js   # Admin CRUD users
│   │   └── profile.controller.js # GET/PUT /api/me
│   ├── services/
│   │   ├── posts.service.js      # DB calls cho posts
│   │   ├── users.service.js      # DB calls cho users
│   │   ├── roles.service.js      # Role assignment + cache invalidation
│   │   └── cache.service.js      # Redis get/set/del helpers
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── posts.routes.js
│   │   ├── users.routes.js
│   │   └── profile.routes.js
│   ├── utils/
│   │   ├── errors.js        # Custom error classes (AppError, ForbiddenError, etc.)
│   │   └── logger.js        # Structured logger (pino hoặc winston)
│   └── app.js
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── unit/
│   │   ├── middlewares/     # auth.mdw.test.js, acl.mdw.test.js
│   │   └── services/        # cache.service.test.js, roles.service.test.js
│   └── integration/
│       └── api/             # posts.test.js, users.test.js, auth.test.js
└── package.json

frontend/
├── src/
│   ├── api/
│   │   └── axios.js         # Axios instance + Firebase token interceptor
│   ├── components/
│   │   ├── ProtectedRoute.jsx   # Redirect if unauthenticated
│   │   ├── AdminRoute.jsx       # Redirect if not ADMIN
│   │   └── LoadingSpinner.jsx
│   ├── config/
│   │   └── firebase.js      # Firebase Client SDK init
│   ├── contexts/
│   │   └── AuthContext.jsx  # Current user state + role
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── PostsPage.jsx        # Danh sách bài post (phân trang + tìm kiếm)
│   │   ├── PostDetailPage.jsx   # Xem chi tiết bài post
│   │   ├── PostFormPage.jsx     # Tạo/sửa bài post
│   │   ├── ProfilePage.jsx      # Hồ sơ cá nhân
│   │   ├── UsersPage.jsx        # [Admin] Danh sách users
│   │   ├── UserDetailPage.jsx   # [Admin] Chi tiết + phân quyền user
│   │   └── ErrorPage.jsx        # 403/404/500
│   └── App.jsx
└── package.json
```

**Quyết định cấu trúc**: Option 2 (Web application — backend + frontend riêng biệt), nhất quán với CLAUDE.md và CONSTITUTION.

## Theo Dõi Độ Phức Tạp

> *Không có vi phạm cần justify — kế hoạch tuân thủ đầy đủ hiến pháp.*

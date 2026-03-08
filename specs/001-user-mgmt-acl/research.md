# Research: Quản lý User & ACL với Firebase Auth

**Ngày**: 2026-03-07 | **Nhánh**: `001-user-mgmt-acl`

---

## 1. Lựa Chọn ORM

**Quyết định**: Prisma 5

**Lý do**:
- Type-safe query builder tự động sinh từ schema — bắt mọi lỗi type tại compile time thay vì runtime
- Migration workflow rõ ràng (`prisma migrate dev`) so với Sequelize (migration file thủ công) và Knex (query builder thuần, không có ORM layer)
- Prisma Client tự tái tạo sau mỗi schema change — luôn nhất quán với DB
- Hỗ trợ PostgreSQL và MySQL (đáp ứng yêu cầu CLAUDE.md)
- Tích hợp tốt với Node.js/Express, không cần TypeScript

**Phương án đã xem xét**:
- Sequelize: mature nhưng config phức tạp, type không tốt, migration verbose
- Knex.js: linh hoạt nhưng là query builder thuần, cần viết thêm model layer

**Cách dùng trong project**:
```js
// backend/src/config/db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
```

---

## 2. Redis Client

**Quyết định**: ioredis 5

**Lý do**:
- Auto-reconnect tích hợp sẵn — quan trọng cho production
- Hỗ trợ Cluster và Sentinel nếu scale sau này
- API Promise-native, không cần promisify thủ công
- Phổ biến hơn `node-redis` trong cộng đồng Express

**Pattern cache role** (từ Constitution):
```js
// GET
const roles = await redis.get(`user:roles:${uid}`);

// SET sau cache-miss
await redis.set(`user:roles:${uid}`, JSON.stringify(roles), 'EX', 3600);

// INVALIDATE khi role thay đổi (đồng bộ, cùng request)
await redis.del(`user:roles:${uid}`);
```

---

## 3. Testing Framework

**Quyết định**:
- Backend: **Jest 29** + **Supertest 6**
- Frontend: **Vitest 1** + **React Testing Library 14**

**Lý do**:
- Jest là tiêu chuẩn de-facto cho Node.js; Supertest cho phép test Express app không cần start server thật
- Vitest tương thích API với Jest, tích hợp native với Vite (dùng cùng config)
- RTL khuyến khích test hành vi user thay vì implementation detail

**Cấu trúc test auth.mdw**:
```js
// tests/unit/middlewares/auth.mdw.test.js
describe('auth middleware', () => {
  test('valid token → sets req.user.uid', ...)
  test('expired token → 401', ...)
  test('missing token → 401', ...)
  test('malformed token → 401', ...)
})
```

**Cấu trúc test acl.mdw**:
```js
// tests/unit/middlewares/acl.mdw.test.js
describe('acl middleware', () => {
  test('cache-hit: ADMIN role → passes through', ...)
  test('cache-hit: USER without permission → 403', ...)
  test('cache-miss: queries DB, caches result, passes through', ...)
  test('cache-miss: DB returns no role → 403', ...)
})
```

**Integration test cache invalidation**:
```js
// tests/integration/api/roles.test.js
test('PATCH /api/users/:id/role → deletes Redis key user:roles:{uid}', async () => {
  await redis.set(`user:roles:${targetUid}`, JSON.stringify(['USER']), 'EX', 3600);
  await request(app).patch(`/api/users/${targetUid}/role`).send({ role: 'ADMIN' })...;
  const cached = await redis.get(`user:roles:${targetUid}`);
  expect(cached).toBeNull();
})
```

---

## 4. Firebase Authentication — Token Verification Pattern

**Quyết định**: `admin.auth().verifyIdToken()` trong auth.mdw.js (server-side only)

**Pattern**:
```js
// backend/src/middlewares/auth.mdw.js
const admin = require('../config/firebase');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Thiếu token xác thực' });
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}
```

**First-login sync pattern** (tạo profile khi user đăng nhập lần đầu):
```js
// POST /api/auth/sync — gọi sau Firebase signIn thành công ở client
async function syncUser(req, res) {
  const { uid, email } = req.user; // từ auth middleware
  let user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) {
    user = await prisma.user.create({
      data: { id: uid, email, display_name: email.split('@')[0], status: 'ACTIVE' }
    });
    // Gán role USER mặc định
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    await prisma.userRole.create({ data: { user_id: uid, role_id: userRole.id } });
  }
  res.json(user);
}
```

---

## 5. Ownership Check Pattern (Post author vs Admin)

**Quyết định**: Kiểm tra ownership trong controller, sau ACL middleware

**Lý do**: ACL middleware chỉ kiểm tra role (ADMIN/USER). Ownership check là logic nghiệp vụ thuộc về controller/service.

**Pattern**:
```js
// posts.controller.js — updatePost
async function updatePost(req, res) {
  const post = await postsService.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Không tìm thấy bài post' });

  const isAuthor = post.author_id === req.user.uid;
  const isAdmin = req.user.roles.includes('ADMIN');

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ message: 'Không có quyền chỉnh sửa bài post này' });
  }
  // ... update logic
}
```

> `req.user.roles` được gắn bởi acl.mdw.js sau khi resolve từ Redis/DB.

---

## 6. Structured Security Logging cho Role Changes

**Quyết định**: Dùng `pino` logger, ghi log mọi thay đổi role (Constitution V)

**Lý do**: `pino` nhanh nhất trong Node.js ecosystem, JSON output, tương thích với log aggregators (Datadog, Loki).

**Pattern**:
```js
// roles.service.js
const logger = require('../utils/logger');

async function assignRole(actorUid, targetUid, newRoleName) {
  const oldRoles = await getUserRoles(targetUid);
  // ... DB update
  await redis.del(`user:roles:${targetUid}`); // cache invalidation đồng bộ
  logger.info({
    event: 'role_changed',
    actor_uid: actorUid,
    target_uid: targetUid,
    old_roles: oldRoles,
    new_role: newRoleName,
    timestamp: new Date().toISOString()
  });
}
```

---

## 7. Soft Delete vs Hard Delete cho User

**Quyết định**: Hỗ trợ cả hai — soft delete (vô hiệu hóa, `status = INACTIVE`) và hard delete (xóa record, bài post giữ lại với `author_id = NULL`)

**Pattern hard delete với orphan posts**:
```js
// users.service.js — deleteUser
async function deleteUser(uid) {
  await prisma.$transaction([
    // Tách bài post khỏi user (set author_id = NULL)
    prisma.post.updateMany({ where: { author_id: uid }, data: { author_id: null } }),
    // Xóa user_roles
    prisma.userRole.deleteMany({ where: { user_id: uid } }),
    // Xóa user
    prisma.user.delete({ where: { id: uid } }),
    // Xóa cache
  ]);
  await redis.del(`user:roles:${uid}`);
}
```

**Hiển thị tên tác giả khi `author_id = NULL`**:
```js
// posts.service.js — getDisplayAuthorName
const authorName = post.author?.display_name ?? 'Người dùng đã xóa';
```

---

## 8. Pagination + Search Pattern

**Quyết định**: Cursor-based hoặc offset-based — chọn **offset-based** (đơn giản hơn, đủ cho scale nhỏ)

**Tìm kiếm**: Prisma `contains` + `mode: 'insensitive'`

```js
// posts.service.js
async function listPosts({ page = 1, limit = 10, search = '' }) {
  const where = search
    ? { title: { contains: search, mode: 'insensitive' } }
    : {};
  const [total, posts] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      include: { author: { select: { display_name: true } } },
      orderBy: { created_at: 'desc' }, // mới nhất trước
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { posts, total, page, totalPages: Math.ceil(total / limit) };
}
```

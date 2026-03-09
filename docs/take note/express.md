# Express — Luồng code & kỹ thuật sử dụng

## Cấu trúc thư mục backend

```
src/
├── app.js              ← Điểm khởi động, gắn middleware & route
├── config/
│   ├── db.js           ← Kết nối PostgreSQL qua Prisma
│   ├── firebase.js     ← Firebase Admin SDK (verify token)
│   └── redis.js        ← Kết nối Redis (cache roles)
├── routes/
│   ├── auth.routes.js  ← POST /api/auth/sync
│   ├── posts.routes.js ← CRUD /api/posts
│   ├── profile.routes.js← GET/PUT /api/me
│   └── users.routes.js ← CRUD /api/users (admin only)
├── middlewares/
│   ├── auth.mdw.js     ← Verify Firebase token, kiểm tra status user
│   └── acl.mdw.js      ← Kiểm tra role (ADMIN/USER)
├── controllers/
│   ├── auth.controller.js
│   ├── posts.controller.js
│   ├── profile.controller.js
│   └── users.controller.js
├── services/
│   ├── cache.service.js← Đọc/ghi/xóa roles trong Redis
│   ├── roles.service.js← Logic phân quyền, assign role
│   ├── posts.service.js← CRUD bài viết
│   └── users.service.js← CRUD user (Firebase + DB)
└── utils/
    ├── errors.js       ← Custom error classes (NotFoundError, ForbiddenError...)
    └── logger.js       ← Pino logger
```

---

## Luồng code từ file đến file — Code chạy như thế nào?

```
node src/app.js  (hoặc npm run dev)
    │
    ▼
app.js
    ├─ require('dotenv').config()     → load biến môi trường từ .env
    ├─ app.use(cors())                → cho phép frontend (khác origin) gọi API
    ├─ app.use(express.json())        → tự parse body JSON thành req.body
    ├─ mount routes:
    │     /api/auth   → auth.routes.js
    │     /api/me     → profile.routes.js
    │     /api/posts  → posts.routes.js
    │     /api/users  → users.routes.js
    └─ app.use(errorHandler)          → global error handler ở cuối
    │
    ▼
app.listen(3000)  → Server sẵn sàng nhận  request

─────── Mỗi khi có request đến ───────────────────────────────
    │
    ▼
Express đọc URL → tìm router khớp với prefix
    │
    ▼
Router (vd: users.routes.js) match method + path cụ thể
    │
    ▼
Middleware chain chạy tuần tự (auth → acl → controller)
    │
    ▼
Controller gọi Service → Service thao tác DB/Redis/Firebase
    │
    ▼
res.json() → gửi response về client
```

**Tóm tắt hình ảnh:**

```
app.js           ← Điểm khởi động, gắn toàn bộ middleware & route
    │
    ├── routes/          ← Định nghĩa URL nào → handler nào
    │     ├── auth.mdw   ← Kiểm tra token Firebase
    │     ├── acl.mdw    ← Kiểm tra role
    │     └── controller ← Nhận req, gọi service, trả res
    │
    ├── services/        ← Logic thật: DB, Redis, Firebase
    │     ├── Prisma     → PostgreSQL
    │     ├── Redis      → Cache roles
    │     └── Firebase   → Tạo/xóa user, verify token
    │
    └── utils/errors.js  ← Lỗi có statusCode → Global Error Handler xử lý
```

---

## Flow 1: Server khởi động

```
[Terminal] npm run dev
    │
    ▼
app.js chạy
    ├─ dotenv load .env → DATABASE_URL, REDIS_URL, FIREBASE credentials...
    ├─ cors() → cho phép request từ http://localhost:5173
    ├─ express.json() → body { "email": "..." } → req.body.email
    │
    ├─ app.use('/api/auth', authRoutes)
    │     auth.routes.js: router.post('/sync', authMiddleware, syncUser)
    │     → URL đầy đủ: POST /api/auth/sync
    │
    ├─ app.use('/api/users', usersRoutes)
    │     users.routes.js: router.get('/', ...adminOnly, ctrl.listUsers)
    │     → URL đầy đủ: GET /api/users
    │
    └─ app.listen(3000) → Server sẵn sàng
```

---

## Flow 2: User đăng nhập — POST /api/auth/sync

Đây là request đầu tiên sau khi Firebase login thành công ở frontend.

```
[Frontend] axios.post('/api/auth/sync')
    + header: Authorization: Bearer <firebase_token>
    │
    ▼
app.js: cors() ✅, express.json() ✅
    │
    ▼
auth.routes.js: match POST /sync
    → chạy: [authMiddleware, syncUser]
    │
    ▼
auth.mdw.js (authMiddleware)
    ├─ đọc req.headers.authorization
    ├─ kiểm tra có dạng "Bearer <token>" không
    │       Không có → res.status(401) ← STOP
    ├─ admin.auth().verifyIdToken(token)
    │       Firebase xác thực token → decoded = { uid, email }
    │       Token sai/hết hạn → res.status(401) ← STOP
    ├─ prisma.user.findUnique({ where: { id: uid } })
    │       Kiểm tra status trong DB
    │       status = INACTIVE → res.status(403) ← STOP
    └─ req.user = { uid, email }
       next() → đi tiếp đến syncUser
    │
    ▼
auth.controller.js (syncUser)
    ├─ đọc req.user.uid, req.user.email
    └─ gọi usersService.findOrCreateUser({ uid, email })
              │
              ▼
        users.service.js (findOrCreateUser)
              ├─ prisma.user.findUnique({ where: { id: uid } })
              │       Tìm thấy → trả về user + roles hiện có
              │       Không thấy → prisma.user.create(...)
              │                  → gán role USER mặc định
              └─ return { user, roles, created }
    │
    ▼
auth.controller.js
    ├─ created=true  → res.status(201)
    └─ created=false → res.status(200)
    res.json({ id, email, display_name, status, roles })
    │
    ▼
[Frontend] nhận { id, email, display_name, roles } → setCurrentUser()
```

---

## Flow 3: Admin lấy danh sách users — GET /api/users

```
[Frontend] axios.get('/api/users?page=1&limit=10')
    + header: Authorization: Bearer <token>
    │
    ▼
app.js → users.routes.js: match GET /
    → chạy: [authMiddleware, requireRole('ADMIN'), ctrl.listUsers]
    │
    ▼
auth.mdw.js
    ├─ verifyIdToken(token) ✅ → decoded = { uid, email }
    ├─ kiểm tra status DB → ACTIVE ✅
    └─ req.user = { uid, email }; next()
    │
    ▼
acl.mdw.js — requireRole('ADMIN')
    ├─ uid = req.user.uid
    ├─ getRoles(uid) → đọc Redis key "user:roles:<uid>"
    │       Cache HIT  → roles = ['ADMIN']
    │       Cache MISS → prisma.userRole.findMany({ where: { user_id: uid } })
    │                  → roles = ['ADMIN']
    │                  → setRoles(uid, roles) → lưu Redis, TTL 1 giờ
    ├─ req.user.roles = ['ADMIN']
    ├─ allowedRoles = ['ADMIN'], roles.includes('ADMIN') ✅
    └─ next()
    │
    ▼
users.controller.js (listUsers)
    ├─ đọc req.query.page, req.query.limit
    └─ usersService.listUsers({ page, limit })
              │
              ▼
        users.service.js
              ├─ prisma.user.findMany({ skip, take, orderBy... })
              │   JOIN với userRole → lấy được roles của từng user
              └─ return { users: [...], total, page, totalPages }
    │
    ▼
res.json({ users, total, page, totalPages }) → Frontend nhận được data
```

---

## Flow 4: Khi có lỗi — Error Handling

```
[users.service.js] throw new NotFoundError('Không tìm thấy user')
    │
    ▼
[users.controller.js] catch(err) { next(err) }
    │   không xử lý lỗi ở đây, đẩy xuống
    │
    ▼
[app.js] Global Error Handler (4 tham số → Express nhận ra đây là error handler)
    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || 500;
        // NotFoundError có statusCode = 404
        // Error thường (không phải AppError) → statusCode = 500
        res.status(statusCode).json({ message: err.message });
    })
    │
    ▼
[Frontend] nhận được { message: "Không tìm thấy user" }, status 404
```

**Hệ thống Error Classes trong `utils/errors.js`:**

```js
// Base class — mang theo statusCode
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Dùng trong service, controller — throw là Global Error Handler tự bắt
throw new NotFoundError('Không tìm thấy user');   // → 404
throw new ForbiddenError('Không có quyền');        // → 403
throw new UnauthorizedError('Chưa xác thực');      // → 401
throw new ConflictError('Email đã tồn tại');       // → 409
throw new ValidationError('Dữ liệu không hợp lệ');// → 400
// Error thường (không phải AppError)              // → 500
```

---

## Flow 5: Redis Cache — Tại sao cần cache roles?

Mỗi request đến route cần role đều phải kiểm tra quyền. Nếu không có cache, **mỗi request = 1 lần query DB**:

```
Không có Redis:
  GET /api/users  → DB query (lấy roles)   ← chậm
  GET /api/posts  → DB query (lấy roles)   ← chậm
  GET /api/me     → DB query (lấy roles)   ← chậm

Có Redis:
  Request 1: Redis MISS → DB query → lưu Redis (TTL 1h)
  Request 2: Redis HIT  → không cần DB ✅ nhanh hơn ~10x
  Request 3: Redis HIT  → không cần DB ✅
  ...
  Sau 1 giờ: TTL hết → Redis MISS → DB query lại
```

**Khi nào cache bị xóa?**

```
assignRole() trong roles.service.js:
    ├─ cập nhật role trong DB (transaction)
    └─ delRoles(targetUid) → xóa cache Redis ngay lập tức
       → Request tiếp theo sẽ đọc lại từ DB → cache mới chính xác
```

---

## Kỹ thuật 1: Middleware

Middleware là hàm nằm **giữa** request và response. Nó có dạng:

```js
function tenMiddleware(req, res, next) {
  // làm gì đó...
  next(); // cho phép đi tiếp
}
```

- `req` — thông tin request (header, body, params...)
- `res` — để gửi response về client
- `next()` — gọi để đi tiếp sang middleware/handler tiếp theo
- `next(err)` — gọi để nhảy thẳng xuống error handler

**`auth.mdw.js`** — verify Firebase token, kiểm tra status, gắn user vào `req`:

```js
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ message: 'Thiếu token' });

  const decoded = await admin.auth().verifyIdToken(token);
  req.user = { uid: decoded.uid, email: decoded.email }; // gắn vào req

  next(); // cho handler tiếp theo chạy
}
```

**`acl.mdw.js`** — lấy roles từ Redis/DB, kiểm tra quyền:

```js
function requireRole(...allowedRoles) {
  return async function(req, res, next) {
    let roles = await getRoles(req.user.uid);     // thử Redis
    if (!roles) {
      roles = await prisma.userRole.findMany(...); // fallback DB
      await setRoles(req.user.uid, roles);         // lưu vào Redis
    }
    req.user.roles = roles;

    const hasRole = allowedRoles.some(r => roles.includes(r));
    if (!hasRole) return res.status(403).json({ message: 'Không có quyền' });

    next();
  };
}
```

---

## Kỹ thuật 2: Router — tách route ra file riêng

Thay vì nhét tất cả vào `app.js`, Express cho phép tách route ra file riêng:

```js
// users.routes.js
const router = Router();
const adminOnly = [authMiddleware, requireRole('ADMIN')];

router.get('/', ...adminOnly, ctrl.listUsers);    // GET  /api/users
router.post('/', ...adminOnly, ctrl.createUser);   // POST /api/users
router.get('/:id', ...adminOnly, ctrl.getUserById);// GET  /api/users/:id
module.exports = router;

// app.js
app.use('/api/users', usersRoutes); // mount vào prefix /api/users
```

Khi gọi `GET /api/users` → Express tìm đến `usersRoutes` → match với `router.get('/')`.

---

## Kỹ thuật 3: Middleware chain trên một route

Một route có thể có **nhiều middleware** chạy tuần tự:

```js
const adminOnly = [authMiddleware, requireRole('ADMIN')];

router.get('/', ...adminOnly, ctrl.listUsers);
// tương đương:
router.get('/', authMiddleware, requireRole('ADMIN'), ctrl.listUsers);
```

Chỉ khi tất cả middleware gọi `next()` thì mới đến controller.

```
authMiddleware → next() → requireRole('ADMIN') → next() → ctrl.listUsers
                                 │
                      roles không có ADMIN → res.status(403) STOP
```

---

## Kỹ thuật 4: Controller & Service — tách trách nhiệm

- **Controller** chỉ lo nhận request và trả response
- **Service** lo logic thật sự (DB, Redis, Firebase)

```js
// Controller — đơn giản, chỉ điều phối
async function listUsers(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await usersService.listUsers({ page, limit }); // gọi service
    res.json(result);
  } catch (err) {
    next(err); // đẩy lỗi xuống Global Error Handler
  }
}

// Service — logic thật: query DB với phân trang
async function listUsers({ page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ skip, take: limit, include: { user_roles: true } }),
    prisma.user.count(),
  ]);
  return { users, total, page, totalPages: Math.ceil(total / limit) };
}
```

---

## Kỹ thuật 5: Global Error Handler

Ở cuối `app.js` có 1 middleware đặc biệt với **4 tham số** — Express tự nhận ra đây là error handler:

```js
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Log lỗi 500 (server bug) ra console/file để debug
  if (statusCode === 500) {
    logger.error({ err }, 'Unhandled server error');
  }

  const message = statusCode === 500 ? 'Lỗi máy chủ nội bộ' : err.message;
  res.status(statusCode).json({ message });
});
```

Khi bất kỳ chỗ nào trong code gọi `next(err)` hoặc `throw`, Express nhảy thẳng vào đây:

```js
// Throw ở service
throw new NotFoundError('Không tìm thấy user'); // statusCode = 404

// controller catch → next(err) → Global Error Handler → res.status(404)
```

---

## Kỹ thuật 6: Middleware gắn dữ liệu vào `req`

`req` là object dùng chung suốt cả chuỗi middleware. Middleware có thể gắn thêm dữ liệu:

```js
// auth.mdw.js gắn user info vào req
req.user = { uid: 'abc123', email: 'user@example.com' };

// acl.mdw.js đọc req.user, rồi gắn thêm roles
req.user.roles = ['ADMIN'];

// Controller đọc được cả uid lẫn roles
const uid = req.user.uid;
const roles = req.user.roles;
```

```
Request đến
    │
auth.mdw  : req.user = { uid, email }
    │
acl.mdw   : req.user.roles = ['ADMIN']
    │
controller: req.user.uid + req.user.roles → dùng thoải mái
```

---

## Kỹ thuật 7: Handler chain — Cơ chế hoạt động chi tiết

### Cấu trúc tham số của `router.METHOD`

```js
router.put('/', authMiddleware, requireRole(), updateMe);
//           ↑   ↑               ↑              ↑
//        path  handler 1      handler 2    handler 3 (cuối)
```

- **Tham số đầu tiên**: luôn là path (route pattern)
- **Tất cả tham số còn lại**: đều là **handler** — không có tên riêng "middleware param" hay "controller param"
- Middleware và controller đều là handler, chỉ khác vị trí và trách nhiệm
- Có thể truyền bằng spread array: `...adminOnly` = trải phần tử của array ra thành nhiều tham số riêng lẻ

### Mỗi handler nhận 3 tham số

```js
function tenHandler(req, res, next) {
  //                ↑    ↑    ↑
  //             thông  gửi  gọi để
  //             tin    res  đi tiếp
  //             request
}
```

| Tham số | Là gì | Dùng để |
|---------|-------|---------|
| `req` | Request object — chứa toàn bộ thông tin từ client | Đọc `req.body`, `req.params`, `req.headers`, `req.user`... |
| `res` | Response object — để gửi dữ liệu về client | Gọi `res.json()`, `res.status(404).json(...)`, `res.send()`... |
| `next` | Hàm callback — điều hướng luồng tiếp theo | Gọi để chuyển sang handler tiếp theo hoặc error handler |

### Luồng chạy: left → right, có thể dừng bất cứ lúc nào

```
router.put('/', authMiddleware, requireRole(), updateMe);
               [   Handler 1  ] [  Handler 2 ] [ Handler 3 ]

Request đến
    │
    ▼
Handler 1: authMiddleware(req, res, next)
    ├─ Token hợp lệ → req.user = { uid } → next()  ──────────────┐
    └─ Token sai    → res.status(401).json(...)  ← STOP (không next)
                                                                   │
    ▼ (chỉ đến đây nếu Handler 1 gọi next())                      │
Handler 2: requireRole()(req, res, next)    ◄──────────────────────┘
    ├─ Có role ADMIN → next()  ─────────────────────────────────────┐
    └─ Không có     → res.status(403).json(...) ← STOP             │
                                                                    │
    ▼ (chỉ đến đây nếu Handler 2 gọi next())                       │
Handler 3: updateMe(req, res, next)         ◄───────────────────────┘
    ├─ Thành công → res.json({ ...user })
    └─ Có lỗi    → next(err) → nhảy sang Error Handler
```

### `next()` — 3 cách dùng và ý nghĩa khác nhau

```js
// 1. next() — không tham số → đi tiếp handler tiếp theo trong chain
next();

// 2. next(err) — truyền error → nhảy thẳng qua tất cả handler còn lại,
//    vào Error Handler 4-tham-số ở cuối app.js
next(new Error('Something broke'));
next(new NotFoundError('User not found')); // → status 404

// 3. next('route') — ít dùng → bỏ qua các handler còn lại của route hiện tại,
//    thử khớp route tiếp theo trong danh sách
next('route');
```

### Handler cuối cùng gọi `next()` — đi đâu?

```js
router.put('/', authMiddleware, requireRole(), updateMe);
//                                             ↑ handler cuối
```

Nếu `updateMe` gọi `next()` (không có err), Express tìm **handler tiếp theo trong toàn bộ app**:

```
Handler cuối gọi next()
    │
    ▼
Express tìm middleware/route tiếp theo khớp với request này
    │
    ├─ Có app.use(errorHandler) ở cuối → vào đó
    ├─ Có app.use((req,res,next) => ...) → vào đó
    └─ Không còn gì → Express tự trả 404 "Cannot PUT /"
```

**Thực tế**: controller thường KHÔNG gọi `next()` — nó kết thúc bằng `res.json()`. Chỉ gọi `next(err)` khi có lỗi.

### Nếu handler KHÔNG gọi `next()` và cũng KHÔNG gửi `res`

```js
function buggyHandler(req, res, next) {
  const user = getUserFromDB(); // giả sử chạy bình thường
  // ← KHÔNG gọi next(), KHÔNG gọi res.json()
  // ← handler kế tiếp sẽ KHÔNG BAO GIỜ chạy
}
```

**Hậu quả**: Client treo vô thời hạn, chờ đến khi timeout (thường 30–60 giây), rồi nhận lỗi "connection timed out".

```
Client gửi request
    │
    ▼
Handler bị bug (không next, không res)
    │
    ▼ ... không có gì xảy ra ...
    │
    ▼ (sau 30–60 giây)
Client: "ERR_EMPTY_RESPONSE" hoặc timeout error
```

### Nếu handler gọi CÙNG LÚC `res.json()` VÀ `next()`

```js
function buggyHandler(req, res, next) {
  res.json({ ok: true }); // ← gửi response về client
  next();                 // ← cố gắng tiếp tục chain ← BUG!
}
```

**Hậu quả**: Handler tiếp theo chạy và cố gửi response lần 2 → Node.js throw lỗi:

```
Error: Cannot set headers after they are sent to the client
```

**Rule**: Sau khi gọi `res.json()` / `res.send()` / `res.status().json()`, phải `return` ngay — không gọi thêm bất cứ thứ gì.

### Tóm tắt — Quyết định trong handler

```
Trong mỗi handler, chỉ được làm MỘT trong 3 việc:

1. next()      → "Tôi xong rồi, đi tiếp đi"
                 Dùng khi: là middleware, đã xử lý xong phần của mình

2. next(err)   → "Có lỗi! Nhảy thẳng xuống Error Handler"
                 Dùng khi: catch được exception, muốn trả lỗi có statusCode

3. res.json()  → "Tôi trả response luôn, chain dừng lại"
   res.send()     Dùng khi: là controller, đây là điểm kết thúc
   res.status(x).json(...)
```

### Ví dụ thực tế — flow đầy đủ

```js
// Route khai báo
const adminOnly = [authMiddleware, requireRole('ADMIN')];
router.get('/', ...adminOnly, ctrl.listUsers);
// Tương đương:
router.get('/', authMiddleware, requireRole('ADMIN'), ctrl.listUsers);

// --- Kịch bản 1: User không có token ---
//   authMiddleware: res.status(401).json() ← STOP
//   requireRole: không chạy
//   listUsers:   không chạy

// --- Kịch bản 2: User có token nhưng role USER, không phải ADMIN ---
//   authMiddleware: next() ✅
//   requireRole:    res.status(403).json() ← STOP
//   listUsers:      không chạy

// --- Kịch bản 3: Admin hợp lệ ---
//   authMiddleware: next() ✅
//   requireRole:    next() ✅
//   listUsers:      res.json({ users: [...] }) ← chain kết thúc

// --- Kịch bản 4: Admin hợp lệ nhưng DB lỗi ---
//   authMiddleware: next() ✅
//   requireRole:    next() ✅
//   listUsers:      next(err) → Error Handler → res.status(500).json()
```


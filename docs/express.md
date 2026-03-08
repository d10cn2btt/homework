# Express — Luồng code & kỹ thuật sử dụng

## Luồng một request đi qua backend

```
Client gửi request
  → app.js: kiểm tra CORS, parse JSON
  → Router: chọn đúng file route xử lý
  → Middleware 1 (auth): kiểm tra token
  → Middleware 2 (acl): kiểm tra role
  → Controller: nhận request, gọi service
  → Service: thao tác DB / Redis
  → Controller: trả response về client
```

Nếu bước nào throw error → nhảy thẳng xuống **Global Error Handler** ở cuối `app.js`.

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

**Trong project này:**

`auth.mdw.js` — verify Firebase token, gắn thông tin user vào `req.user`:
```js
// Sau khi verify xong, các handler sau có thể dùng req.user.uid
req.user = { uid: decoded.uid, email: decoded.email };
next();
```

`acl.mdw.js` — lấy roles từ Redis/DB, kiểm tra user có đủ quyền không:
```js
// Nếu không có role phù hợp → trả 403 luôn, không đi tiếp
if (!hasRole) {
  return res.status(403).json({ message: 'Không có quyền truy cập' });
}
```

---

## Kỹ thuật 2: Router — tách route ra file riêng

Thay vì nhét tất cả vào `app.js`, Express cho phép tách route ra file riêng:

```js
// users.routes.js
const router = Router();
router.get('/', ...adminOnly, ctrl.listUsers);
router.post('/', ...adminOnly, ctrl.createUser);
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

---

## Kỹ thuật 4: Controller & Service — tách trách nhiệm

- **Controller** chỉ lo nhận request và trả response
- **Service** lo logic thật sự (DB, Redis, Firebase)

```js
// Controller — đơn giản, chỉ điều phối
async function createUser(req, res, next) {
  try {
    const { email, display_name, password } = req.body;
    const user = await usersService.createUser(admin, { email, display_name, password });
    res.status(201).json(user);
  } catch (err) {
    next(err); // đẩy lỗi xuống error handler
  }
}

// Service — logic thật: tạo trên Firebase rồi lưu DB
async function createUser(adminSdk, { email, display_name, password }) {
  const firebaseUser = await adminSdk.auth().createUser({ email, password });
  const user = await prisma.user.create({ data: { id: firebaseUser.uid, ... } });
  return user;
}
```

---

## Kỹ thuật 5: Global Error Handler

Ở cuối `app.js` có 1 middleware đặc biệt với **4 tham số** — Express tự nhận ra đây là error handler:

```js
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ message: err.message });
});
```

Khi bất kỳ chỗ nào trong code gọi `next(err)` hoặc throw error, Express sẽ nhảy thẳng vào đây. Project dùng custom error classes để mang theo statusCode:

```js
// Throw ở service
throw new NotFoundError('Không tìm thấy người dùng'); // statusCode = 404

// Error handler tự xử lý, trả đúng HTTP status
```

---

## Kỹ thuật 6: Middleware gắn dữ liệu vào `req`

`req` là object dùng chung suốt cả chuỗi middleware. Middleware có thể gắn thêm dữ liệu vào đó để các handler sau dùng:

```js
// auth.mdw.js gắn user vào req
req.user = { uid: '...', email: '...' };

// acl.mdw.js đọc req.user, rồi gắn thêm roles
req.user.roles = ['ADMIN'];

// Controller đọc được cả uid lẫn roles
const uid = req.user.uid;
const roles = req.user.roles;
```

---

## Tóm tắt luồng thực tế: Admin lấy danh sách users

```
GET /api/users
  ↓
app.js: parse JSON body
  ↓
users.routes.js: match GET /
  ↓
auth.mdw.js:
  - Lấy token từ header Authorization
  - Gọi Firebase Admin verifyIdToken()
  - Gắn req.user = { uid, email }
  ↓
acl.mdw.js (requireRole('ADMIN')):
  - Lấy roles từ Redis (key: user:roles:{uid})
  - Nếu không có → query DB → lưu vào Redis
  - Kiểm tra roles có chứa 'ADMIN' không
  ↓
ctrl.listUsers:
  - Đọc req.query.page, req.query.limit
  - Gọi usersService.listUsers()
  ↓
usersService.listUsers:
  - Query PostgreSQL qua Prisma (có phân trang)
  - Trả về { users, total, page, totalPages }
  ↓
res.json(result) → client nhận được data
```

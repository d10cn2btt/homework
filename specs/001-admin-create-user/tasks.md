# Tasks: 001-admin-create-user

## Backend
- [x] Setup Firebase Admin SDK (config/firebase.js)
- [x] Setup Prisma + PostgreSQL (config/db.js)
- [x] Setup Redis ioredis (config/redis.js)
- [x] Viết `auth.mdw.js` — verify Firebase token, set req.user
- [x] Viết `acl.mdw.js` — check role từ Redis/DB
- [x] Viết `users.service.js` — getMe, listUsers, updateRole (có cache invalidation)
- [x] Viết `auth.controller.js` — xử lý request/response
- [x] Định nghĩa routes: GET /users/me, GET /users, PUT /users/:id/role

## Tests
- [x] Unit test: auth.mdw.js (valid token, expired token, missing token)
- [x] Unit test: acl.mdw.js (cache hit, cache miss, forbidden)
- [x] Integration test: GET /users/me, GET /users, PUT /users/:id/role

## Frontend
- [x] Setup Firebase JS SDK (config/firebase.js)
- [x] Setup Axios instance với auto-attach token (api/axiosInstance.js)
- [x] AuthContext — lưu current user state
- [x] LoginPage — form email/password
- [x] Dashboard — route sau khi login thành công

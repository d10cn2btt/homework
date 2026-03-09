# CLAUDE.md

## Stack
- **Backend**: Node.js + Express, Prisma + PostgreSQL, Redis (ioredis), Jest + Supertest
- **Frontend**: React (Vite) + Firebase JS SDK, Axios
- **Auth**: Firebase Authentication — verifyIdToken() từ Firebase Admin SDK, KHÔNG tự hash password
- **Env**: mọi credentials trong `.env`, không hardcode

## Auth Flow (backbone — không được sai)
1. Client gửi `Authorization: Bearer <Firebase ID Token>`
2. `auth.mdw.js` → `admin.auth().verifyIdToken()` → set `req.user = { uid, email }`
3. `acl.mdw.js` → check Redis `user:roles:{uid}` → fallback DB → check role

## Redis Cache
- Key: `user:roles:{uid}` — value: array role names, TTL: 1 giờ
- Cache miss: query DB → ghi Redis
- Khi đổi role user: **xóa cache ngay** sau khi update DB, không đợi expire

## Conventions
- Service layer chứa toàn bộ DB/Redis logic — controller không query DB trực tiếp
- File không quá 300 dòng, function không quá 40 dòng
- Không commit `console.log`, dead code, hoặc commented-out code

## Docs
- `docs/spec.md` — raw requirements từ khách hàng
- `docs/system_design.md` — kiến trúc tổng thể của project
- `docs/decisions.md` — quyết định kỹ thuật đã confirm
- `docs/api_contract.md` — request/response shape của tất cả endpoints
- `specs/{feature}/design.md` — brainstorm + system design của từng feature
- `specs/{feature}/tasks.md` — task list của feature đang làm

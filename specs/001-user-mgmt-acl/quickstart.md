# Quickstart: Thiết Lập Môi Trường Dev

**Ngày**: 2026-03-07 | **Nhánh**: `001-user-mgmt-acl`

## Yêu Cầu Hệ Thống

| Công cụ | Phiên bản tối thiểu |
|---------|-------------------|
| Node.js | 20 LTS |
| npm | 9+ |
| PostgreSQL | 15+ |
| Redis | 7+ |
| Git | 2.40+ |

---

## 1. Clone & Cài Đặt

```bash
git clone <repo-url>
cd homework
git checkout 001-user-mgmt-acl
```

---

## 2. Cấu Hình Firebase

1. Tạo project tại [Firebase Console](https://console.firebase.google.com)
2. Bật **Authentication → Sign-in method → Email/Password**
3. Tải **Service Account JSON** (Project Settings → Service Accounts → Generate new private key)
4. Lưu file là `backend/firebase-service-account.json` (đã có trong `.gitignore`)
5. Lấy **Firebase Web Config** (Project Settings → General → Your apps → Web app)

---

## 3. Backend Setup

```bash
cd backend
npm install
```

Tạo file `backend/.env`:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/homework_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# Firebase Admin
FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"

# Server
PORT=3000
NODE_ENV=development
```

Khởi tạo database và seed:
```bash
# Chạy migrations
npx prisma migrate dev --name init

# Seed roles (ADMIN + USER)
npx prisma db seed
```

Tạo file `backend/prisma/seed.js`:
```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
  await prisma.role.upsert({ where: { name: 'USER' }, update: {}, create: { name: 'USER' } });
  console.log('Seeded roles: ADMIN, USER');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Thêm vào `backend/package.json`:
```json
{
  "prisma": { "seed": "node prisma/seed.js" }
}
```

Chạy backend:
```bash
npm run dev
```

---

## 4. Frontend Setup

```bash
cd frontend
npm install
```

Tạo file `frontend/.env`:
```env
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_APP_ID="your-app-id"
VITE_API_BASE_URL="http://localhost:3000/api"
```

Chạy frontend:
```bash
npm run dev
```

---

## 5. Tạo Admin User Đầu Tiên

Firebase không tự động cấp role ADMIN. Sau khi đăng nhập lần đầu:

```bash
# Lấy UID từ Firebase Console hoặc log server khi user sync
# Chạy script seed admin
cd backend
node scripts/seed-admin.js <firebase-uid>
```

Tạo file `backend/scripts/seed-admin.js`:
```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAdmin(uid) {
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  await prisma.userRole.upsert({
    where: { user_id_role_id: { user_id: uid, role_id: adminRole.id } },
    update: {},
    create: { user_id: uid, role_id: adminRole.id }
  });
  // Xóa USER role nếu có
  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  await prisma.userRole.deleteMany({ where: { user_id: uid, role_id: userRole.id } });
  console.log(`Admin role assigned to uid: ${uid}`);
}

const uid = process.argv[2];
if (!uid) { console.error('Usage: node seed-admin.js <uid>'); process.exit(1); }
seedAdmin(uid).catch(console.error).finally(() => prisma.$disconnect());
```

---

## 6. Chạy Tests

```bash
# Backend tests
cd backend
npm test                    # Chạy tất cả
npm test -- --coverage      # Với coverage report

# Frontend tests
cd frontend
npm test
```

---

## 7. Scripts Package.json

### Backend (`backend/package.json`)
```json
{
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "lint": "eslint src/"
  }
}
```

### Frontend (`frontend/package.json`)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/"
  }
}
```

---

## 8. Kiểm Tra Nhanh (Smoke Test)

```bash
# 1. Đăng ký user qua Firebase Console hoặc client
# 2. Lấy ID Token từ Firebase (dùng emulator hoặc client)

# 3. Sync user
curl -X POST http://localhost:3000/api/auth/sync \
  -H "Authorization: Bearer <ID_TOKEN>"

# 4. Lấy danh sách bài post
curl http://localhost:3000/api/posts \
  -H "Authorization: Bearer <ID_TOKEN>"

# 5. Tạo bài post
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello", "content": "World"}'
```

---

## 9. Cấu Trúc .env Files (tóm tắt)

| File | Mô tả | Trong git? |
|------|-------|------------|
| `backend/.env` | Cấu hình server | ❌ (gitignore) |
| `backend/.env.example` | Template | ✅ |
| `backend/firebase-service-account.json` | Firebase Admin key | ❌ (gitignore) |
| `frontend/.env` | Cấu hình client | ❌ (gitignore) |
| `frontend/.env.example` | Template | ✅ |

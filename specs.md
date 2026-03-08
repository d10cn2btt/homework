# Product Specifications

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + Tailwind CSS |
| Auth (Client) | Firebase JS SDK (email/password) |
| Backend | Node.js + Express |
| Auth (Server) | Firebase Admin SDK |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis |

---

## 2. Roles & Permissions

- Hệ thống có đúng **2 roles**: `ADMIN`, `USER`
- Mỗi user chỉ có **1 role** tại một thời điểm
- Role mặc định khi user đăng nhập lần đầu: `USER`

| Action | USER | ADMIN |
|---|---|---|
| Xem published posts của người khác | ✅ | ✅ |
| CRUD post của chính mình | ✅ | ✅ |
| Xem/sửa profile bản thân | ✅ | ✅ |
| Quản lý users (CRUD + đổi role) | ❌ | ✅ |
| Xóa/sửa post của người khác | ❌ | ❌ |

---

## 3. Database Schema

```sql
-- Firebase UID làm PK
users
  id           TEXT PRIMARY KEY   -- Firebase UID
  email        TEXT NOT NULL UNIQUE
  display_name TEXT
  status       ENUM('active', 'inactive') DEFAULT 'active'
  created_at   TIMESTAMP DEFAULT NOW()

roles
  id   SERIAL PRIMARY KEY
  name TEXT NOT NULL UNIQUE  -- 'ADMIN' | 'USER'

user_roles
  user_id  TEXT REFERENCES users(id) ON DELETE CASCADE
  role_id  INT  REFERENCES roles(id)
  PRIMARY KEY (user_id)      -- enforce 1 user = 1 role

posts
  id         SERIAL PRIMARY KEY
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE
  title      TEXT NOT NULL
  content    TEXT
  status     ENUM('draft', 'published') DEFAULT 'draft'
  created_at TIMESTAMP DEFAULT NOW()
  updated_at TIMESTAMP DEFAULT NOW()
```

---

## 4. Authentication & User Sync Flow

1. Client đăng nhập qua Firebase JS SDK → nhận `ID Token`
2. Client gọi `POST /api/auth/sync` với token → BE verify + upsert user vào DB
   - Nếu user chưa có trong DB → tạo mới với role `USER`
   - Nếu đã có → cập nhật `email`, `display_name` từ Firebase
3. Mọi API tiếp theo gửi `Authorization: Bearer <ID_TOKEN>`
4. `auth.mdw.js` verify token → gắn `req.user = { uid, email, ... }`
5. `acl.mdw.js` đọc role từ Redis (cache hit) hoặc DB (cache miss) → kiểm tra quyền

---

## 5. Redis Caching Strategy

- **Key**: `user:roles:{uid}`
- **Value**: tên role, ví dụ `"ADMIN"`
- **TTL**: 1 giờ
- **Cache miss**: query DB → ghi vào Redis
- **Cache invalidation**: khi Admin đổi role của user → xóa key `user:roles:{uid}` ngay sau khi UPDATE DB thành công

---

## 6. API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/sync` | Firebase Token | Sync Firebase user vào DB sau login |

### Profile (bản thân)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/profile` | ✅ | Xem profile của mình |
| PUT | `/api/profile` | ✅ | Cập nhật `display_name` |

### Posts
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/posts` | ✅ | Xem published posts của tất cả + draft của chính mình |
| GET | `/api/posts/:id` | ✅ | Xem 1 post (published = ai cũng xem, draft = chỉ chủ) |
| POST | `/api/posts` | ✅ | Tạo post mới |
| PUT | `/api/posts/:id` | ✅ (chủ) | Sửa post của mình |
| DELETE | `/api/posts/:id` | ✅ (chủ) | Xóa post của mình |

### Users (Admin only)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | ADMIN | Danh sách tất cả users |
| GET | `/api/users/:id` | ADMIN | Xem chi tiết 1 user |
| POST | `/api/users` | ADMIN | Tạo user mới (tạo trên Firebase + ghi DB) |
| PUT | `/api/users/:id` | ADMIN | Sửa thông tin user |
| DELETE | `/api/users/:id` | ADMIN | Xóa user (**chặn nếu là ADMIN cuối cùng**) |
| PUT | `/api/users/:id/role` | ADMIN | Đổi role → invalidate Redis cache |

---

## 7. Business Rules

- **Xóa ADMIN cuối cùng**: `DELETE /api/users/:id` phải đếm số ADMIN còn lại. Nếu = 1 → trả về `400 Bad Request`.
- **Post visibility**:
  - `published` → tất cả user đã đăng nhập đều thấy
  - `draft` → chỉ chủ bài thấy
- **Sửa/Xóa post**: chỉ chủ bài được thực hiện (kiểm tra `post.user_id === req.user.uid`)
- **Profile**: chỉ update được `display_name`, không sửa email

---

## 8. Frontend Pages

### Shared
- Header: tên user, nút logout
- Route guard: chưa login → redirect `/login`

### Pages

| Page | Route | Role | Description |
|---|---|---|---|
| Login | `/login` | Public | Đăng nhập Firebase |
| Dashboard | `/` | ALL | Feed các published posts |
| My Posts | `/my-posts` | ALL | CRUD posts của mình |
| Post Detail | `/posts/:id` | ALL | Xem chi tiết post |
| Profile | `/profile` | ALL | Xem & sửa display_name |
| User Management | `/admin/users` | ADMIN | Bảng CRUD users + đổi role |

---

## 9. Folder Structure

### Backend
```
backend/
├── src/
│   ├── config/
│   │   ├── db.js           # Prisma client
│   │   ├── redis.js        # Redis client
│   │   └── firebase.js     # Firebase Admin init
│   ├── middlewares/
│   │   ├── auth.mdw.js     # Verify Firebase Token → req.user
│   │   └── acl.mdw.js      # Check role từ Redis/DB
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── profile.controller.js
│   │   ├── post.controller.js
│   │   └── user.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── post.service.js
│   │   ├── user.service.js
│   │   └── role.service.js  # Redis cache logic
│   ├── routes/
│   │   ├── auth.route.js
│   │   ├── profile.route.js
│   │   ├── post.route.js
│   │   └── user.route.js
│   └── app.js
├── prisma/
│   └── schema.prisma
└── package.json
```

### Frontend
```
frontend/
├── src/
│   ├── api/
│   │   ├── axios.js        # Axios instance, auto-attach token
│   │   ├── auth.api.js
│   │   ├── post.api.js
│   │   └── user.api.js
│   ├── components/         # Shared UI components
│   ├── config/
│   │   └── firebase.js
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── MyPosts.jsx
│   │   ├── PostDetail.jsx
│   │   ├── Profile.jsx
│   │   └── admin/
│   │       └── UserManagement.jsx
│   ├── hooks/              # useAuth, usePosts...
│   └── App.jsx
└── package.json
```

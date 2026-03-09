# Design: Admin Create User + ACL + Firebase Auth (Core)

## Yêu cầu
Admin có thể tạo user mới trong hệ thống. Hệ thống có phân quyền ADMIN/USER.
Đăng nhập qua Firebase Authentication (email/password).

## Các hướng đã cân nhắc

### Hướng 1: Tự quản lý user + password (traditional)
- Ưu: không phụ thuộc bên ngoài
- Nhược: phải tự handle hash password, session, token rotation — phức tạp, rủi ro bảo mật cao

### Hướng 2: Firebase Authentication + DB lưu role
- Ưu: Firebase xử lý auth, ta chỉ cần verify token; không lưu password; security best practices có sẵn
- Nhược: phụ thuộc Firebase, cần Firebase Admin SDK trên backend

### Hướng 3: Firebase Auth + Redis cache role
- Ưu: giảm DB query cho mỗi request (mọi API đều phải check role)
- Nhược: cần xử lý cache invalidation khi role thay đổi

## Quyết định: Hướng 3
Lý do: Hướng 2 là baseline tốt, nhưng thêm Redis cache là cần thiết vì mọi API request đều phải qua ACL middleware — không cache sẽ bottleneck ở DB.

## System Design

### Auth flow
1. Client login qua Firebase JS SDK → nhận ID Token
2. Mọi API request gửi `Authorization: Bearer <ID_TOKEN>`
3. `auth.mdw.js` gọi `admin.auth().verifyIdToken()` → set `req.user = { uid, email }`
4. `acl.mdw.js` check Redis `user:roles:{uid}` → fallback DB nếu miss → check role

### DB Schema
```
users: id (Firebase UID), email, display_name, status
roles: id, name (ADMIN | USER)
user_roles: user_id, role_id
```

### Redis Cache
- Key: `user:roles:{uid}`, Value: `["ADMIN"]`, TTL: 1 giờ
- Cache miss: query DB → write Redis
- Invalidation: xóa key ngay khi admin đổi role (không đợi TTL expire)

### Edge cases
- User chưa tồn tại trong DB sau khi Firebase tạo: tự động upsert khi gọi `/users/me`
- Admin tự hạ quyền mình: cho phép nhưng cache phải invalidate ngay
- Token hết hạn: Firebase tự refresh, FE dùng `getIdToken(true)` để force refresh

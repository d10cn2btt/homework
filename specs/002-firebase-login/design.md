# Design: Firebase Social Login (Google + GitHub)

## Yêu cầu từ khách hàng
Thêm đăng nhập bằng Google và GitHub vào hệ thống hiện tại (đã có email/password).

---

## Firebase Social Login hoạt động thế nào?

```
[User click "Login with Google"]
        ↓
Firebase JS SDK → signInWithPopup() → Google OAuth popup
        ↓
Google xác thực user → trả credential về Firebase
        ↓
Firebase tạo/link user, trả về Firebase ID Token
        ↓
onAuthStateChanged fires → AuthContext gọi /auth/sync
        ↓
Backend: verifyIdToken() → findOrCreateUser() → DB upsert
        ↓
User vào dashboard
```

**Key insight:** Backend không cần biết user dùng provider nào. Firebase luôn trả về cùng một loại ID Token — auth middleware và ACL không thay đổi gì.

---

## Quyết định thiết kế

### 1. Providers: Google + GitHub
- **Google**: Firebase tự xử lý hoàn toàn, không cần credentials thêm (chỉ bật trong Console)
- **GitHub**: Cần tạo GitHub OAuth App và điền Client ID + Secret vào Firebase Console

### 2. UX: Popup (không dùng Redirect)
- `signInWithPopup()` — user không rời khỏi trang, đơn giản hơn để implement
- Redirect phù hợp mobile hơn nhưng phức tạp hơn (cần handle `getRedirectResult()`)

### 3. Auto-create account
- Lần đầu login → Firebase tạo user → backend `/auth/sync` upsert vào DB với role USER
- Giống flow hiện tại của email/password — không cần thêm bước nhập thông tin

### 4. Edge case: GitHub user ẩn email
- GitHub cho phép user đặt email private → Firebase token có thể không có `email`
- Giải pháp: dùng placeholder `{uid}@github.users.noreply` nếu email null
- UID là unique → placeholder không bao giờ conflict với email thật

### 5. Error: `auth/account-exists-with-different-credential`
- Xảy ra khi cùng một email đã đăng ký qua provider khác (VD: email/password → sau đó thử GitHub)
- Firebase block mặc định để bảo vệ user
- Giải pháp: hiển thị message thân thiện, không auto-merge provider

---

## Firebase Console Setup (thủ công, không phải code)

### Google
1. Firebase Console → Authentication → Sign-in method
2. Enable Google provider
3. Không cần credentials thêm

### GitHub
1. Tạo GitHub OAuth App tại `github.com/settings/developers`
   - Homepage URL: URL của app
   - Authorization callback URL: `https://{project-id}.firebaseapp.com/__/auth/handler`
2. Copy Client ID + Client Secret
3. Firebase Console → Authentication → Sign-in method → GitHub → dán vào

---

## Những gì KHÔNG thay đổi
- `auth.mdw.js` — verifyIdToken() hoạt động với mọi provider
- `acl.mdw.js` — không đổi
- `/auth/sync` endpoint — không đổi
- DB schema — không đổi (User.id = Firebase UID)
- `AuthContext.jsx` — onAuthStateChanged tự xử lý mọi provider

---

## Files cần thay đổi

| File | Loại thay đổi |
|------|--------------|
| `frontend/src/pages/LoginPage.jsx` | Thêm 2 nút social login, handle popup errors |
| `backend/src/services/users.service.js` | `findOrCreateUser()` handle email = null |

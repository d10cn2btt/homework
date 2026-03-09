# Tasks: 002-firebase-login

## Backend
- [ ] Không cần thay đổi — verifyIdToken() hoạt động với mọi Firebase provider

## Tests
- [ ] Update integration test auth.test.js: mock token từ Google provider
- [ ] Update unit test auth.mdw.test.js: đảm bảo không hardcode provider

## Frontend
- [ ] Bật Google provider trong Firebase Console
- [ ] Bật GitHub provider trong Firebase Console + cấu hình GitHub OAuth App
- [ ] Tạo `googleSignIn()` và `githubSignIn()` trong AuthContext (dùng signInWithPopup)
- [ ] Thêm nút "Sign in with Google" vào LoginPage
- [ ] Thêm nút "Sign in with GitHub" vào LoginPage
- [ ] Xử lý lỗi popup: `auth/popup-closed-by-user` → toast thông báo
- [ ] Xử lý lỗi: `auth/account-exists-with-different-credential` → thông báo rõ cho user

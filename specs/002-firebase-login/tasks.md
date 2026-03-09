# Tasks: 002-firebase-login

## Firebase Console (thủ công)
- [ ] Enable Google Sign-in provider trong Firebase Console
- [ ] Tạo GitHub OAuth App, lấy Client ID + Secret
- [ ] Enable GitHub Sign-in provider trong Firebase Console, điền credentials

## Backend
- [x] `users.service.js` — `findOrCreateUser()`: handle `email = null` từ GitHub
  - Nếu email null → dùng `${uid}@github.users.noreply` làm placeholder

## Frontend
- [x] `LoginPage.jsx` — import thêm `signInWithPopup`, `GoogleAuthProvider`, `GithubAuthProvider`
- [x] `LoginPage.jsx` — thêm `handleSocialLogin(provider)` function
  - Gọi `signInWithPopup(auth, provider)`
  - Bỏ qua error `auth/popup-closed-by-user` và `auth/cancelled-popup-request`
  - Hiển thị message cho các lỗi khác
- [x] `LoginPage.jsx` — thêm `getErrorMessage` cases mới
  - `auth/account-exists-with-different-credential`
  - `auth/popup-blocked`
- [x] `LoginPage.jsx` — thêm UI: divider "hoặc" + 2 nút Google và GitHub

## Testing
- [ ] Test Google login — user mới → check DB có record với role USER
- [ ] Test GitHub login — account có email public → check DB
- [ ] Test GitHub login — account email private → check DB có placeholder email
- [ ] Test login lại lần 2 (idempotent — không tạo duplicate)
- [ ] Test error: cùng email đăng nhập bằng 2 provider khác nhau
- [ ] Test popup bị đóng giữa chừng — không hiện error

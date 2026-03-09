# Design: Firebase Additional Login Methods

## Yêu cầu
Bổ sung thêm các phương thức đăng nhập qua Firebase ngoài email/password:
- Google Sign-In (P1)
- GitHub Sign-In (P2)

## Các hướng đã cân nhắc

### Hướng 1: signInWithPopup
- Ưu: đơn giản, Firebase handle toàn bộ redirect flow, UX nhanh trên desktop
- Nhược: không hoạt động tốt trong mobile webview

### Hướng 2: signInWithRedirect
- Ưu: mobile-friendly, hoạt động mọi môi trường
- Nhược: phức tạp hơn, cần handle redirect state (getRedirectResult), UX kém hơn trên desktop

## Quyết định: Hướng 1 (signInWithPopup)
Lý do: App không cần support mobile webview ở giai đoạn này. Popup đơn giản hơn và UX tốt hơn cho target user hiện tại.

## System Design

### Flow
1. User click "Sign in with Google/GitHub" → `signInWithPopup(provider)`
2. Firebase xử lý OAuth flow → trả về `UserCredential`
3. Lấy ID Token từ `UserCredential.user.getIdToken()`
4. Gọi backend như bình thường với token (không cần endpoint mới)
5. Backend: `verifyIdToken()` hoạt động với mọi Firebase provider — không cần thay đổi

### Lưu ý quan trọng
- Backend **không cần thay đổi** — `verifyIdToken()` verify được token từ mọi provider
- Chỉ cần thay đổi ở Frontend: thêm provider và nút login
- Lần đầu login với Google/GitHub: user chưa có trong DB → `upsert` khi gọi `/users/me` (đã handle ở 001)

### Edge cases
- User cancel popup → bắt lỗi `auth/popup-closed-by-user`, hiện toast thông báo, không throw
- User đã có tài khoản email/password với cùng email → Firebase báo lỗi `auth/account-exists-with-different-credential`, cần hướng dẫn merge hoặc thông báo rõ
- Network error trong lúc popup → bắt lỗi chung, cho retry

# Research: Màn hình tạo người dùng mới cho Admin

**Branch**: `001-admin-create-user` | **Date**: 2026-03-08

## Tóm tắt phát hiện

Tất cả công nghệ đã được xác định qua constitution + codebase hiện có. Không có NEEDS CLARIFICATION còn tồn tại sau phiên làm rõ.

---

## 1. Firebase rollback khi DB thất bại

**Quyết định**: Nếu `prisma.user.create()` thất bại sau khi `adminSdk.auth().createUser()` đã thành công, phải gọi `adminSdk.auth().deleteUser(firebaseUser.uid)` để rollback.

**Lý do**: Ngăn "ghost account" — tài khoản tồn tại trong Firebase nhưng không có hồ sơ trong DB. Người dùng này sẽ không thể đăng nhập vào ứng dụng (middleware sẽ không tìm thấy hồ sơ) nhưng chiếm mất email trong Firebase.

**Thay thế đã xem xét**:
- Tạo DB trước, Firebase sau: Nếu Firebase thất bại, không cần rollback DB (đơn giản hơn). Tuy nhiên Firebase là identity provider — tạo DB record trước khi có UID Firebase là không thể vì UID là khóa chính.
- Eventual consistency / retry queue: Quá phức tạp cho scope hiện tại.

**Hiện trạng codebase**: `users.service.js` đã có try/catch cho Firebase creation nhưng KHÔNG có rollback nếu DB step thất bại (dòng 94-106).

---

## 2. Trường `display_name` — bắt buộc hay tùy chọn

**Quyết định**: `display_name` là **tùy chọn**. Nếu bỏ trống, hệ thống dùng phần trước ký tự `@` của email làm giá trị mặc định.

**Lý do**: Spec FR-002 và phiên làm rõ xác nhận `display_name` là optional. UX tốt hơn — Admin không cần biết tên người dùng để tạo tài khoản nhanh.

**Hiện trạng codebase**: Controller hiện validate `display_name` là bắt buộc (`if (!email || !display_name || !password)`). Cần sửa.

---

## 3. Toast notification sau khi tạo thành công

**Quyết định**: Sau khi tạo thành công, frontend redirect về `/admin/users` và hiển thị toast thành công. Toast được truyền qua React Router `state` (location state pattern).

**Lý do**: Pattern phổ biến với React Router v6 — truyền `{ toast: 'message' }` qua `navigate('/admin/users', { state: { toast: '...' } })`, `UsersPage` đọc `location.state` và hiển thị banner.

**Thay thế đã xem xét**:
- Global toast store (Context/Zustand): Overkill cho scope này.
- URL query param (`?created=true`): Lộ thông tin trong URL, có thể bị refresh lặp lại.

---

## 4. Luồng tạo người dùng — thứ tự các bước

**Quyết định**: Thứ tự: (1) Validate input client-side → (2) `POST /api/users` → (3) Backend tạo Firebase account → (4) Backend tạo DB record (rollback nếu thất bại) → (5) Return 201 → (6) Frontend redirect + toast.

**Lý do**: Validate client-side trước để UX nhanh (không round-trip server cho lỗi rõ ràng như password < 6 chars). Server validate lại để bảo mật.

---

## 5. Validation rules tổng hợp

| Trường | Bắt buộc | Ràng buộc |
|--------|----------|-----------|
| email | Có | Định dạng email hợp lệ, chưa tồn tại trong hệ thống |
| display_name | Không | Tối đa 100 ký tự; mặc định = phần trước @ của email |
| password | Có | Tối thiểu 6 ký tự (Firebase minimum) |

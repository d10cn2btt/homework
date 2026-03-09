# Decision Log

<!-- Format: ## YYYY-MM-DD — Tên quyết định -->
<!-- Ghi lý do, không chỉ ghi kết quả -->

## 2026-03-08 — ORM: Prisma

Chọn Prisma thay vì Sequelize/Knex. Lý do: type-safety tốt hơn, schema migration rõ ràng, tooling mạnh hơn.

**Hệ quả:** Mọi DB query đi qua Prisma client, không raw SQL trừ khi cực kỳ cần thiết.

---

## 2026-03-08 — Auth: Firebase, không tự hash password

Không lưu password vào DB. Firebase Authentication xử lý hoàn toàn.

**Hệ quả:** `auth.mdw.js` luôn gọi `verifyIdToken()`, không check password hay session tự quản lý.

---

## 2026-03-08 — Redis TTL = 1 giờ cho user roles

Trade-off giữa freshness và performance: role thay đổi hiếm, 1h là hợp lý.

**Hệ quả:** Khi admin đổi role user, bắt buộc xóa cache `user:roles:{uid}` ngay sau khi update DB.

---

## 2026-03-09 — Social login: account linking flow cho provider conflict

Firebase treat Google là trusted provider — khi Google login với email đã tồn tại (kể cả tạo bởi GitHub), Firebase tự động link mà không throw error. Chiều ngược lại (GitHub gặp account Google) thì throw `auth/account-exists-with-different-credential`.

**Giải pháp:** Khi GitHub bị conflict, lưu GitHub credential + email vào `pendingLink` state, hướng dẫn user login Google. Sau khi Google login thành công, verify email khớp rồi gọi `linkWithCredential()` — link cả 2 provider vào 1 Firebase UID.

**Hệ quả:**
- User có thể login bằng cả Google lẫn GitHub sau khi link
- `pendingLink` mất khi F5 — chấp nhận được, user thử lại là xong
- Email verify trước khi link để tránh trường hợp chọn nhầm Google account

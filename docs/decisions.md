# Decision Log

<!-- Format: ## YYYY-MM-DD — Tên quyết định -->
<!-- Ghi lý do, không chỉ ghi kết quả -->

## 2026-03-08 — ORM: Prisma
Chọn Prisma thay vì Sequelize/Knex. Lý do: type-safety tốt hơn, schema migration rõ ràng, tooling mạnh hơn.
Hệ quả: Mọi DB query đi qua Prisma client, không raw SQL trừ khi cực kỳ cần thiết.

## 2026-03-08 — Auth: Firebase, không tự hash password
Không lưu password vào DB. Firebase Authentication xử lý hoàn toàn.
Hệ quả: `auth.mdw.js` luôn gọi `verifyIdToken()`, không check password hay session tự quản lý.

## 2026-03-08 — Redis TTL = 1 giờ cho user roles
Trade-off giữa freshness và performance: role thay đổi hiếm, 1h là hợp lý.
Hệ quả: Khi admin đổi role user, bắt buộc xóa cache `user:roles:{uid}` ngay sau khi update DB.

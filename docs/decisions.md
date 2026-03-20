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

## 2026-03-09 — Chat realtime: raw WebSocket, không dùng Socket.io

Chọn native `ws` package thay vì Socket.io. Lý do: mục tiêu là hiểu protocol-level flow (HTTP Upgrade handshake, frame parsing, broadcast thủ công) trước khi dùng abstraction.

**Hệ quả:**
- Auth phải xử lý riêng ở WS upgrade event (không dùng được Express middleware chain trực tiếp)
- Registry in-memory (`Map<uid, Set<ws>>`) — single-instance only, document rõ
- Broadcast tự implement, không có built-in rooms như Socket.io

---

## 2026-03-09 — Chat: WS token truyền qua query param

Browser WebSocket API không support custom headers khi handshake. Chọn `?token=<firebase_id_token>` trong URL thay vì header.

**Hệ quả:** Token lộ trong server access log (URL được log). Mitigation: log sanitization hoặc dùng short-lived token riêng — [TBD khi cần].

---

## 2026-03-20 — Chat load balancing: Hướng A (Gateway + connId registry)

Chọn API Gateway làm WS proxy + connId registry thay vì Redis Pub/Sub (Hướng B). Lý do: cần tách WS transport layer ra khỏi business logic Instance để scale 2 tầng độc lập; deliver targeted thay vì fan-out; Instance hoàn toàn stateless HTTP.

**Hệ quả:**
- Gateway là process riêng biệt (không phải Express Instance), 1 instance duy nhất (SPOF accepted)
- Redis lưu `ws:registry:{userId} → [{connId, gatewayUrl}]` (array để hỗ trợ multi-device)
- `gatewayUrl` là fixed `http://gateway:8080` (docker internal hostname)

---

## 2026-03-20 — Gateway runtime: Node.js + ws package

Chọn Node.js thay vì Go cho Gateway process. Lý do: cùng runtime với Instance (không thêm ngôn ngữ mới), event loop phù hợp giữ nhiều WS connection đồng thời, đủ tốt cho scale hiện tại.

**Hệ quả:** Nếu sau này cần giữ >50k WS connections đồng thời thì revisit Go (goroutine per conn, ~8KB vs ~50KB memory per connection).

---

## 2026-03-20 — LB: Nginx đứng giữa Gateway và Instance; 1 Gateway instance (SPOF accepted)

Nginx làm LB cho Instance pool. Gateway là 1 instance duy nhất — client connect thẳng, không cần LB trước Gateway. SPOF accepted ở giai đoạn này, scale multi-gateway để sau.

**Hệ quả:** `gatewayUrl` trong Redis là fixed `http://gateway:8080` (docker internal hostname), không có service discovery phức tạp. Khi cần scale Gateway thì cần bổ sung Gateway LB và revisit routing logic.

---

## 2026-03-20 — WS registry: lưu array thay vì single entry để hỗ trợ multi-device

Redis key `ws:registry:{userId}` lưu array `[{connId, gatewayId, gatewayUrl}]` thay vì single object. Lý do: user có thể mở nhiều tab/thiết bị đồng thời — nếu overwrite thì tab cũ mất delivery.

**Hệ quả:** Instance phải iterate qua array khi deliver; phải xóa đúng entry (theo connId) khi disconnect, không xóa cả key.

---

## 2026-03-09 — Social login: account linking flow cho provider conflict

Firebase treat Google là trusted provider — khi Google login với email đã tồn tại (kể cả tạo bởi GitHub), Firebase tự động link mà không throw error. Chiều ngược lại (GitHub gặp account Google) thì throw `auth/account-exists-with-different-credential`.

**Giải pháp:** Khi GitHub bị conflict, lưu GitHub credential + email vào `pendingLink` state, hướng dẫn user login Google. Sau khi Google login thành công, verify email khớp rồi gọi `linkWithCredential()` — link cả 2 provider vào 1 Firebase UID.

**Hệ quả:**
- User có thể login bằng cả Google lẫn GitHub sau khi link
- `pendingLink` mất khi F5 — chấp nhận được, user thử lại là xong
- Email verify trước khi link để tránh trường hợp chọn nhầm Google account

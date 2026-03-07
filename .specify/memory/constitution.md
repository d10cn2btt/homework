<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0 (MINOR — nội dung viết lại hoàn toàn bằng tiếng Việt,
bổ sung chi tiết từ system_design.md)

Nguyên tắc thay đổi:
  I.   Code Quality (NON-NEGOTIABLE)        — giữ nguyên tên, cập nhật nội dung tiếng Việt
  II.  Tiêu Chuẩn Kiểm Thử                 — đổi tên từ "Testing Standards"
  III. Nhất Quán Trải Nghiệm Người Dùng    — đổi tên từ "User Experience Consistency"
  IV.  Yêu Cầu Hiệu Năng                   — đổi tên từ "Performance Requirements"
  V.   Bảo Mật & Toàn Vẹn Phân Quyền      — đổi tên từ "Security & Authorization Integrity"

Phần thêm mới: N/A
Phần xóa: N/A

Templates cập nhật:
  ✅ .specify/templates/plan-template.md   — Constitution Check khớp với 5 nguyên tắc bên dưới
  ✅ .specify/templates/spec-template.md   — Các phần bắt buộc giữ nguyên, không thay đổi ràng buộc
  ✅ .specify/templates/tasks-template.md  — Phân loại task phủ đủ: bảo mật, cache, kiểm thử

Follow-up TODOs: Không có — tất cả placeholder đã được điền từ system_design.md.
-->

# Hiến Pháp Hệ Thống Quản Lý User & Phân Quyền ACL

## Nguyên Tắc Cốt Lõi

### I. Chất Lượng Code (BẮT BUỘC TUYỆT ĐỐI)

Mỗi đơn vị code — middleware, service, controller, hay component — BẮT BUỘC có một
trách nhiệm duy nhất, được định nghĩa rõ ràng. File KHÔNG ĐƯỢC vượt quá 300 dòng;
phải tách ra khi vượt. Hàm KHÔNG ĐƯỢC vượt quá 40 dòng; phải phân rã khi vượt.

- Tên biến/hàm BẮT BUỘC rõ ràng, thể hiện đúng ý nghĩa (không dùng `data`, `tmp`,
  `handler` nếu không có ngữ cảnh cụ thể).
- Không được commit code chết, khối bị comment-out, hoặc `console.log`
  (dùng structured logging thay thế).
- Mọi giá trị phụ thuộc môi trường (DB URL, Firebase credentials, Redis URL) BẮT BUỘC
  đặt trong biến môi trường — không được hardcode.
- Dependencies BẮT BUỘC được pin đúng version trong `package.json`
  (ví dụ: `"express": "4.18.2"`, không dùng `"^4"`).

**Lý do**: Trong hệ thống nhạy cảm về bảo mật (auth + ACL), code mơ hồ hoặc cồng kềnh
làm tăng bề mặt tấn công và khiến việc audit trở nên bất khả thi.

### II. Tiêu Chuẩn Kiểm Thử

Toàn bộ logic nghiệp vụ backend (services, middlewares) BẮT BUỘC có unit test trước khi
một tính năng được coi là hoàn thành. Integration test BẮT BUỘC bao phủ mọi API endpoint
có xác thực.

- `auth.mdw.js` và `acl.mdw.js` BẮT BUỘC có unit test riêng biệt, bao gồm các kịch bản:
  token hợp lệ, token hết hạn, thiếu token, không đủ quyền, và cả hai nhánh
  cache-hit và cache-miss.
- Logic xóa cache Redis BẮT BUỘC được kiểm thử bằng integration test, xác nhận rằng key
  `user:roles:{uid}` bị xóa sau khi API thay đổi role thực thi thành công.
- Độ phủ kiểm thử BẮT BUỘC duy trì ≥ 80% cho `backend/src/middlewares/`
  và `backend/src/services/`.
- Frontend: mọi page component render có điều kiện theo role BẮT BUỘC có test cho từng
  nhánh role (ADMIN thấy / USER không thấy, v.v.).

**Lý do**: Luồng xóa cache Redis và logic verify Firebase token là các điểm thất bại
rủi ro cao, không trực quan. Kiểm thử là lưới an toàn duy nhất đáng tin cậy.

### III. Nhất Quán Trải Nghiệm Người Dùng

Giao diện BẮT BUỘC cung cấp trải nghiệm nhất quán, dự đoán được trên mọi trạng thái role.

- Loading state BẮT BUỘC hiển thị cho mọi thao tác bất đồng bộ (API call đang xử lý).
- Thông báo lỗi hiển thị cho người dùng BẮT BUỘC dễ đọc và có tính hướng dẫn —
  không được hiển thị raw error object hoặc stack trace.
- Các phần tử UI bị giới hạn theo role BẮT BUỘC được ẩn đi (không chỉ disable) khi
  người dùng thiếu quyền, và KHÔNG ĐƯỢC dựa chỉ vào kiểm tra role phía frontend cho mục
  đích bảo mật.
- Điều hướng và layout BẮT BUỘC ổn định về mặt thị giác trên cả hai role ADMIN và USER;
  chỉ nội dung/hành động khác nhau.
- Form BẮT BUỘC validate input phía client trước khi submit và hiển thị lỗi theo từng
  field, không hiển thị dưới dạng alert chung.

**Lý do**: UX không nhất quán xung quanh phân quyền gây nhầm lẫn cho người dùng và
tăng gánh nặng hỗ trợ; các phần tử bị disable còn để lộ tính năng bị giới hạn cho
người dùng không có quyền.

### IV. Yêu Cầu Hiệu Năng

Thời gian phản hồi API BẮT BUỘC đạt các mục tiêu sau trong điều kiện tải bình thường
(single-instance):

- Endpoint CRUD có xác thực: p95 ≤ 200ms.
- Luồng kiểm tra role (cache hit): p95 ≤ 20ms overhead bổ sung.
- Luồng kiểm tra role (cache miss → DB): p95 ≤ 80ms overhead bổ sung.

Redis BẮT BUỘC được dùng làm store chính cho việc resolve role, theo pattern key
`user:roles:{uid}` và TTL là 3600 giây (1 giờ). Xóa cache BẮT BUỘC xảy ra đồng bộ
trong cùng request thực hiện thay đổi role — không được defer hay để eventual.

Truy vấn database trong services BẮT BUỘC sử dụng cột đã được index cho việc lookup
(`users.id`, `user_roles.user_id`). Pattern N+1 query bị nghiêm cấm; dùng JOIN hoặc
batched query thay thế.

**Lý do**: Mọi API call đều đi qua ACL middleware. Không có Redis cache, DB trở thành
bottleneck tỉ lệ thuận với lượng request. Xóa cache đồng bộ ngăn ngừa cửa sổ leo thang
đặc quyền do dữ liệu cũ.

### V. Bảo Mật & Toàn Vẹn Phân Quyền

Firebase Authentication là identity provider duy nhất. Backend TUYỆT ĐỐI KHÔNG ĐƯỢC
tin vào thông tin định danh do client cung cấp — chỉ `uid` được trích xuất từ Firebase
ID Token hợp lệ thông qua `admin.auth().verifyIdToken()` mới là nguồn chân lý.

- Phân quyền BẮT BUỘC được thực thi phía server trên mọi endpoint được bảo vệ.
  Ẩn element theo role ở frontend chỉ là UX — không phải kiểm soát bảo mật.
- ACL middleware BẮT BUỘC chạy trước mọi logic controller trên các route được bảo vệ.
- API gán role BẮT BUỘC chỉ dành cho role ADMIN và BẮT BUỘC ghi log mọi thay đổi role
  (uid người thực hiện, uid người bị thay đổi, role cũ, role mới, timestamp).
- HTTP response KHÔNG ĐƯỢC để lộ thông tin nội bộ: không stack trace, không thông báo
  lỗi DB, không Firebase error code cho người gọi chưa xác thực.
- Toàn bộ input API BẮT BUỘC được validate và sanitize trước khi đến tầng service hoặc DB.

**Lý do**: ACL middleware cấu hình sai hoặc bỏ qua kiểm tra phân quyền có thể cấp quyền
admin đầy đủ cho bất kỳ user đã xác thực nào. Bảo vệ theo chiều sâu ở tầng server là bắt buộc.

## Ràng Buộc Tech Stack

Tech stack của project này là cố định. Mọi thay đổi cần amendment qua quy trình quản trị.

| Tầng | Công nghệ được phê duyệt |
|---|---|
| Frontend | React (Vite), Firebase JS SDK |
| Backend | Node.js + Express |
| Identity Provider | Firebase Authentication (email/password) |
| Xác thực Token | Firebase Admin SDK (`admin.auth().verifyIdToken()`) |
| Database | PostgreSQL hoặc MySQL qua Prisma, Sequelize, hoặc Knex |
| Cache | Redis (key pattern: `user:roles:{uid}`, TTL: 3600s) |
| HTTP Client | Axios (với interceptor tự động đính kèm Firebase ID Token) |

Lựa chọn ORM/query builder BẮT BUỘC được ghi lại trong `plan.md` trước khi bắt đầu
implement. Chuyển đổi ORM giữa chừng một tính năng yêu cầu governance amendment.

## Quy Trình Phát Triển & Cổng Chất Lượng

**Trước khi implement** bất kỳ tính năng nào:

1. `spec.md` BẮT BUỘC được viết và review.
2. `plan.md` BẮT BUỘC ghi rõ: lựa chọn ORM, cấu trúc thư mục, API contracts,
   và kiểm tra constitution.
3. `tasks.md` BẮT BUỘC được sinh ra với thứ tự dependency trước khi bắt đầu code.

**Trong quá trình implement**:

- Commit sau mỗi task hoàn thành trong `tasks.md` — không gộp bulk vào cuối.
- Không được mở PR khi còn test thất bại hoặc linting error.
- Logic xóa cache Redis BẮT BUỘC được implement trong cùng task với endpoint thay đổi
  role — không được để sang task riêng biệt sau.

**Trước khi merge**:

- Toàn bộ test pass (`npm test`).
- Không có `console.log`, secret hardcoded, hoặc code bị comment-out.
- Các endpoint API được test thủ công với cả hai role ADMIN và USER.
- Endpoint thay đổi role được xác nhận xóa cache Redis (có thể quan sát qua log
  hoặc test assertion).

## Quản Trị

Hiến pháp này thay thế mọi thực hành phát triển và quy ước không chính thức khác.
Áp dụng cho tất cả contributor và toàn bộ code trong repository này.

**Quy trình amendment**:

1. Đề xuất thay đổi dưới dạng GitHub issue hoặc mô tả PR, tham chiếu đến nguyên tắc bị ảnh hưởng.
2. Giải thích thay đổi bằng bằng chứng cụ thể (dữ liệu hiệu năng, phát hiện bảo mật,
   nghiên cứu UX).
3. Cập nhật `CONSTITUTION_VERSION` theo quy tắc semantic versioning.
4. Cập nhật `LAST_AMENDED_DATE` về ngày amendment.
5. Truyền thay đổi sang tất cả template phụ thuộc (`plan-template.md`, `spec-template.md`,
   `tasks-template.md`) trong cùng một commit.

**Chính sách versioning**:
- MAJOR: Xóa hoặc tái định nghĩa căn bản một nguyên tắc.
- MINOR: Thêm nguyên tắc mới hoặc mở rộng đáng kể hướng dẫn.
- PATCH: Làm rõ câu chữ, sửa lỗi đánh máy, tinh chỉnh không thay đổi ngữ nghĩa.

**Tuân thủ**: Mọi PR review BẮT BUỘC có bước kiểm tra tuân thủ hiến pháp. Reviewer BẮT BUỘC
từ chối các PR vi phạm Nguyên tắc I (Chất Lượng Code), Nguyên tắc II (Kiểm Thử), hoặc
Nguyên tắc V (Bảo Mật) mà không có ngoại lệ.

**Phiên bản**: 1.1.0 | **Phê duyệt lần đầu**: 2026-03-07 | **Sửa đổi lần cuối**: 2026-03-07

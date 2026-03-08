# Tasks: Màn hình tạo người dùng mới cho Admin

**Input**: Design documents from `/specs/001-admin-create-user/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tóm tắt**: 11 tasks | 3 user stories | Backend 2 files cần sửa | Frontend 2 files cần sửa + 1 file tạo mới

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Có thể chạy song song (files khác nhau, không phụ thuộc task chưa xong)
- **[Story]**: US1 / US2 / US3 — tương ứng kịch bản trong spec

---

## Phase 1: Setup

**Purpose**: Đưa working directory về trạng thái sạch trước khi bắt đầu thay đổi

- [x] T001 Commit unstaged change `parseInt` fix đang có trong `backend/src/services/users.service.js` (từ bug fix trước) trước khi bắt đầu implement tính năng này

---

## Phase 2: Foundational (Backend fixes)

**Purpose**: Vá 2 lỗi trong backend API đã tồn tại — bắt buộc hoàn thành trước khi frontend có thể hoạt động đúng

**⚠️ CRITICAL**: Toàn bộ 3 user stories phụ thuộc vào 2 task này

- [x] T002 Sửa `backend/src/services/users.service.js` — hàm `createUser`: (a) thêm `const resolvedName = display_name?.trim() || email.split('@')[0]` và dùng `resolvedName` thay `display_name`; (b) bao quanh các dòng `prisma.user.create` + `prisma.role.findUnique` bằng try/catch, trong catch gọi `await adminSdk.auth().deleteUser(firebaseUser.uid)` rồi re-throw
- [x] T003 [P] Sửa `backend/src/controllers/users.controller.js` — hàm `createUser`: đổi điều kiện validation từ `!email || !display_name || !password` thành `!email || !password`; cập nhật message lỗi tương ứng

**Checkpoint**: `POST /api/users` với `display_name` bỏ trống phải trả 201 với tên mặc định từ email; nếu giả lập DB lỗi, Firebase account phải bị xóa

---

## Phase 3: User Story 1 — Admin tạo tài khoản người dùng mới (P1) 🎯 MVP

**Goal**: Admin có thể điền form và tạo tài khoản thành công, sau đó thấy toast và người dùng mới trong danh sách

**Independent Test**: Đăng nhập Admin → nhấn "Thêm người dùng" → điền email mới + mật khẩu → submit → xác nhận redirect về danh sách kèm banner xanh + người dùng mới xuất hiện

### Implementation for User Story 1

- [x] T004 [P] [US1] Tạo `frontend/src/pages/UserCreatePage.jsx` — form 3 trường (email required, display_name optional, password required); state: `{ email, displayName, password, saving, error }`; submit gọi `api.post('/users', {...})`; khi thành công: `navigate('/admin/users', { state: { toast: 'Đã tạo người dùng thành công' } })`; khi lỗi: hiển thị `error` message từ response
- [x] T005 [P] [US1] Sửa `frontend/src/App.jsx` — import `UserCreatePage`; thêm route `/admin/users/new` bọc trong `<ProtectedRoute><AdminRoute>` đặt **trước** route `/admin/users/:id`
- [x] T006 [US1] Sửa `frontend/src/pages/UsersPage.jsx` — thêm `useLocation`; đọc `location.state?.toast`; nếu có, render `<div className="...">` success banner màu xanh ở đầu trang; sau khi render xóa state bằng `window.history.replaceState({}, '', location.pathname)` trong `useEffect`

**Checkpoint**: Luồng tạo user đầy đủ hoạt động — form → submit → redirect + toast → user trong list

---

## Phase 4: User Story 2 — Validation form (P2)

**Goal**: Admin nhận phản hồi lỗi cụ thể per-field khi điền dữ liệu không hợp lệ

**Independent Test**: Lần lượt thử: (1) bỏ trống email → thấy lỗi email, (2) mật khẩu 5 ký tự → thấy lỗi mật khẩu, (3) email đã tồn tại → thấy lỗi trùng email; trong mỗi trường hợp form không submit và không tạo tài khoản

### Implementation for User Story 2

- [x] T007 [US2] Thêm client-side validation vào `frontend/src/pages/UserCreatePage.jsx` — trước khi gọi API: kiểm tra email không rỗng + regex format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), password không rỗng + độ dài ≥ 6; nếu không hợp lệ set `error` message và `return` sớm (không gọi API); hiển thị `error` dưới field tương ứng (không phải alert chung)
- [x] T008 [US2] Map server error responses thành message thân thiện trong `frontend/src/pages/UserCreatePage.jsx` — trong catch block: HTTP 409 → `'Email này đã được sử dụng'`; HTTP 400 → dùng `err.response.data.message`; các lỗi khác → `'Không thể tạo tài khoản. Vui lòng thử lại.'`

**Checkpoint**: Tất cả kịch bản lỗi trong spec hiển thị đúng thông báo, form giữ nguyên dữ liệu đã nhập

---

## Phase 5: User Story 3 — Kiểm soát quyền truy cập (P3)

**Goal**: Người dùng không phải Admin bị chặn truy cập trang tạo người dùng

**Independent Test**: Đăng nhập tài khoản USER → nhập trực tiếp `/admin/users/new` → xác nhận redirect về `/403`; đăng xuất → nhập lại URL → xác nhận redirect về `/login`

### Implementation for User Story 3

- [x] T009 [US3] Xác nhận route `/admin/users/new` trong `frontend/src/App.jsx` (từ T005) bọc đúng thứ tự `<ProtectedRoute><AdminRoute>` — `ProtectedRoute` xử lý unauthenticated (redirect `/login`), `AdminRoute` xử lý non-admin (redirect `/403`); không cần thêm code nếu T005 đã làm đúng

**Checkpoint**: Non-admin nhận `/403`; unauthenticated nhận `/login`; Admin truy cập bình thường

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T010 [P] Chạy toàn bộ checklist trong `specs/001-admin-create-user/quickstart.md` — 5 kịch bản kiểm tra thủ công
- [x] T011 [P] Kiểm tra tuân thủ constitution: không có `console.log`, hàm ≤ 40 dòng, file ≤ 300 dòng trong tất cả files đã sửa/tạo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: Không phụ thuộc — bắt đầu ngay
- **Foundational (T002, T003)**: Phụ thuộc T001 — CHẶN tất cả user stories
- **US1 (T004–T006)**: Phụ thuộc T002 + T003
- **US2 (T007–T008)**: Phụ thuộc T004 (cùng file UserCreatePage)
- **US3 (T009)**: Phụ thuộc T005 (cùng file App.jsx)
- **Polish (T010–T011)**: Phụ thuộc tất cả stories hoàn thành

### User Story Dependencies

- **US1 (P1)**: Phụ thuộc Foundational — không phụ thuộc US2/US3
- **US2 (P2)**: Phụ thuộc US1 (cùng file UserCreatePage.jsx)
- **US3 (P3)**: Có thể chạy song song với US2 (file khác: App.jsx)

### Parallel Opportunities

| Task | Có thể chạy song song với |
|------|--------------------------|
| T003 [P] | T002 (files khác nhau) |
| T004 [P] | T005 [P] (files khác nhau) |
| T007 | T009 (files khác nhau) |
| T010 [P] | T011 [P] (tasks độc lập) |

---

## Parallel Example: US1

```text
Sau khi T002 + T003 xong, khởi chạy song song:
  - T004: Tạo UserCreatePage.jsx
  - T005: Cập nhật App.jsx (route mới)

Sau T004 + T005 xong:
  - T006: Cập nhật UsersPage.jsx (toast)
```

---

## Implementation Strategy

### MVP (US1 only)

1. T001 → T002 → T003 → T004 + T005 (song song) → T006
2. **DỪNG và KIỂM TRA**: Luồng tạo user đầy đủ hoạt động
3. Demo cho stakeholder nếu đủ

### Incremental

1. MVP → validate US1 → merge
2. Thêm T007 + T008 → validate US2 → merge
3. Thêm T009 (verify) → validate US3 → merge
4. Polish T010 + T011

---

## Notes

- T009 có thể là 0-code nếu T005 đã bọc đúng — chỉ cần verify thủ công
- US2 (T007, T008) **sửa cùng file** với T004 — làm tuần tự, không song song
- Commit sau mỗi task hoặc mỗi phase hoàn thành (per constitution)

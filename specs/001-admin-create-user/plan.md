# Implementation Plan: Màn hình tạo người dùng mới cho Admin

**Branch**: `001-admin-create-user` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-admin-create-user/spec.md`

## Summary

Tính năng cung cấp màn hình tạo tài khoản người dùng mới cho Admin với form nhập email, tên hiển thị (tùy chọn) và mật khẩu tạm thời. Backend API `POST /api/users` đã tồn tại nhưng cần vá hai lỗi: (1) thiếu rollback Firebase khi DB thất bại, (2) `display_name` không nên là bắt buộc. Frontend cần tạo mới hoàn toàn: page component, route, và toast notification.

## Technical Context

**Language/Version**: Node.js 18+ (backend), React 18 + Vite (frontend)
**Primary Dependencies**: Express 4.x, Prisma (ORM), Firebase Admin SDK (backend) | React Router v6, Axios, Firebase JS SDK (frontend)
**Storage**: PostgreSQL qua Prisma (schema đã có, không cần migration)
**Testing**: Jest (backend unit tests)
**Target Platform**: Web — Chrome/Firefox/Edge modern versions
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: CRUD endpoint p95 ≤ 200ms (per constitution IV)
**Constraints**: File ≤ 300 dòng, hàm ≤ 40 dòng (per constitution I)
**Scale/Scope**: Single-user-at-a-time admin operation; no concurrency concern

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Trạng thái | Ghi chú |
|------------|-----------|---------|
| I. Chất lượng Code | PASS | File mới < 300 dòng; hàm < 40 dòng; không hardcode |
| II. Tiêu chuẩn kiểm thử | PASS | Service `createUser` cần unit test bao gồm rollback case |
| III. UX nhất quán | PASS | Loading state (disable button), lỗi per-field, toast sau tạo |
| IV. Hiệu năng | PASS | Không query mới phức tạp; schema đã có index trên `users.id` |
| V. Bảo mật | PASS | ACL middleware đã bảo vệ route; không expose stack trace |

**Không có vi phạm — tiến hành Phase 1.**

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-create-user/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── POST-api-users.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── controllers/
│   │   └── users.controller.js     ← sửa: bỏ display_name khỏi required check
│   └── services/
│       └── users.service.js        ← sửa: rollback Firebase + display_name default

frontend/
├── src/
│   ├── pages/
│   │   ├── UserCreatePage.jsx      ← tạo mới
│   │   └── UsersPage.jsx           ← sửa: đọc toast từ location.state
│   └── App.jsx                     ← sửa: thêm route /admin/users/new
```

**Structure Decision**: Web application — Option 2. Không tạo file mới ở backend (chỉ sửa 2 file hiện có); tạo 1 file mới ở frontend và sửa 2 file hiện có.

## Phase 0: Research

Xem [research.md](research.md) — tất cả quyết định đã được giải quyết:
- Firebase rollback pattern khi DB thất bại
- `display_name` optional với default logic
- Toast notification qua React Router location state
- Validation rules tổng hợp

## Phase 1: Design & Contracts

### Data Model

Xem [data-model.md](data-model.md) — không có schema migration. Sử dụng tables hiện có (`users`, `roles`, `user_roles`).

### API Contracts

Xem [contracts/POST-api-users.md](contracts/POST-api-users.md):
- `POST /api/users` — Admin only, returns 201 với user object
- Firebase rollback documented trong error flow
- `display_name` optional với default behavior

### Quickstart

Xem [quickstart.md](quickstart.md) — danh sách cụ thể 5 thay đổi cần thực hiện với code examples.

## Complexity Tracking

Không có vi phạm constitution. Bảng này bỏ trống.

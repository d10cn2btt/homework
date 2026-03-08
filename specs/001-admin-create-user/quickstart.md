# Quickstart: Tính năng tạo người dùng mới (Admin)

**Branch**: `001-admin-create-user`

## Tổng quan các thay đổi cần thực hiện

Tính năng này yêu cầu thay đổi cả backend và frontend. Backend API đã có sẵn nhưng cần vá hai lỗi; frontend cần tạo mới hoàn toàn.

## Backend — Các thay đổi cần thiết

### 1. Sửa `backend/src/services/users.service.js` — hàm `createUser`

**Vấn đề 1**: Thiếu rollback Firebase nếu DB insert thất bại.

```js
// Thêm try/catch bao quanh DB operations
// Nếu thất bại → adminSdk.auth().deleteUser(firebaseUser.uid)
```

**Vấn đề 2**: `display_name` cần default về phần trước @ của email nếu bỏ trống.

```js
const resolvedDisplayName = display_name?.trim() || email.split('@')[0];
```

### 2. Sửa `backend/src/controllers/users.controller.js` — hàm `createUser`

**Vấn đề**: Validation hiện yêu cầu `display_name` bắt buộc. Cần bỏ `display_name` khỏi check bắt buộc.

```js
// Trước: if (!email || !display_name || !password)
// Sau:   if (!email || !password)
```

## Frontend — Các thay đổi cần thiết

### 3. Tạo `frontend/src/pages/UserCreatePage.jsx`

Form với 3 trường: email (required), display_name (optional), password (required).

Sau khi tạo thành công:
```js
navigate('/admin/users', { state: { toast: 'Đã tạo người dùng thành công' } });
```

### 4. Cập nhật `frontend/src/App.jsx`

Thêm route `/admin/users/new` **trước** route `/admin/users/:id`:

```jsx
<Route path="/admin/users/new" element={<AdminRoute><UserCreatePage /></AdminRoute>} />
<Route path="/admin/users/:id" element={<AdminRoute><UserDetailPage /></AdminRoute>} />
```

### 5. Cập nhật `frontend/src/pages/UsersPage.jsx`

Đọc `location.state.toast` và hiển thị banner thành công thoáng qua:

```js
const location = useLocation();
// Hiển thị banner nếu location.state?.toast tồn tại
// Xóa state sau khi hiển thị (replace history)
```

## Kiểm tra thủ công

1. Đăng nhập Admin → vào Quản lý người dùng → nhấn "Thêm người dùng"
2. Điền form với email mới, không điền tên hiển thị → tạo → xác nhận display_name = phần trước @
3. Thử tạo với email đã tồn tại → xác nhận thông báo lỗi
4. Thử tạo với mật khẩu 5 ký tự → xác nhận bị chặn
5. Đăng nhập USER thường → truy cập trực tiếp `/admin/users/new` → xác nhận bị từ chối

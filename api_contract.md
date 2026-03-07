📝 API Contract & Convention

Tài liệu này định nghĩa các quy chuẩn giao tiếp (API Convention) giữa Frontend (React) và Backend (Express), đồng thời liệt kê danh sách các API cốt lõi của hệ thống.

1. Quy chuẩn chung (General Conventions)

1.1. Base URL & Authentication

Base URL: /api/v1 (Ví dụ: https://api.domain.com/api/v1)

Authentication: Tất cả các API yêu cầu xác thực (Private) đều phải đính kèm Header:

Authorization: Bearer <FIREBASE_ID_TOKEN>


1.2. Chuẩn HTTP Status Codes

Backend bắt buộc phải trả về đúng Status Code để Frontend dễ dàng dùng Axios Interceptor bắt lỗi toàn cục:

200 OK: Xử lý thành công.

201 Created: Tạo mới tài nguyên thành công.

400 Bad Request: Client gửi sai định dạng dữ liệu (Validation Error).

401 Unauthorized: Token hết hạn, sai hoặc chưa gửi Token. (FE tự động redirect về trang Login).

403 Forbidden: Token hợp lệ nhưng User không đủ quyền (Role) thực hiện. (FE hiện màn hình Access Denied).

404 Not Found: Không tìm thấy tài nguyên.

500 Internal Server Error: Lỗi logic Backend hoặc Database.

1.3. Định dạng Response chuẩn (Standard Response Format)

Hệ thống thống nhất một format JSON duy nhất cho mọi Response.

✅ Thành công (Success Response):

{
  "success": true,
  "data": { ... }, // Payload dữ liệu chính (Object hoặc Array)
  "meta": { ... }  // (Tùy chọn) Dùng cho phân trang: { "page": 1, "limit": 10, "total": 50 }
}


❌ Thất bại (Error Response):

{
  "success": false,
  "error": {
    "code": "ERROR_CODE_NAME", // Mã lỗi để FE dễ map với nội dung đa ngôn ngữ (i18n)
    "message": "Thông báo lỗi chi tiết để dev debug",
    "details": [] // (Tùy chọn) Danh sách lỗi chi tiết nếu là lỗi Validation Form
  }
}


2. Danh sách API cốt lõi (Core Endpoints)

2.1. Quản lý bản thân (Profile)

GET /api/v1/users/me

Mô tả: Lấy thông tin profile và role của user đang đăng nhập. FE gọi API này sau khi đăng nhập thành công để lưu vào Context/Redux.

Quyền (ACL): Bất kỳ user nào đã đăng nhập.

Response:

{
  "success": true,
  "data": {
    "id": "firebase_uid_123",
    "email": "user@example.com",
    "display_name": "Nguyen Van A",
    "roles": ["USER"]
  }
}


2.2. Quản lý Người dùng (Dành cho Admin)

GET /api/v1/users

Mô tả: Lấy danh sách toàn bộ user (có phân trang).

Quyền (ACL): Yêu cầu role ADMIN.

Query Params: ?page=1&limit=20

Response:

{
  "success": true,
  "data": [
    { "id": "uid_1", "email": "admin@test.com", "roles": ["ADMIN"] },
    { "id": "uid_2", "email": "user@test.com", "roles": ["USER"] }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2
  }
}


PUT /api/v1/users/:id/role

Mô tả: Cập nhật Role cho một User cụ thể. Lưu ý: API này ở BE phải xử lý xóa Cache Redis của user đó.

Quyền (ACL): Yêu cầu role ADMIN.

Request Body:

{
  "roles": ["ADMIN", "USER"] 
}


Response:

{
  "success": true,
  "data": {
    "message": "Cập nhật quyền thành công."
  }
}

🏗️ System Architecture Design: Firebase Auth & ACL

Tài liệu này phác thảo kiến trúc tổng thể cho hệ thống Web/App với Stack: React (FE) + Express (BE) + Firebase Auth + DB (SQL) + Redis (Cache).

1. Luồng Xác thực Tổng thể (Authentication Flow)

Client (React): Sử dụng Firebase JS SDK để user đăng nhập bằng Email/Password. Nhận về ID Token.

Client -> Backend: Gọi API bằng axios hoặc fetch, đính kèm token:

Authorization: Bearer <FIREBASE_ID_TOKEN>


Backend Server (Express):

Chạy qua AuthMiddleware sử dụng Firebase Admin SDK (admin.auth().verifyIdToken()) để lấy uid.

Chạy qua AclMiddleware để kiểm tra Role của uid này trước khi vào Controller.

2. Thiết kế Phân quyền (Role-Based Access Control - DB Backed)

Vì hệ thống chỉ cần phân quyền ở mức Role, ta sẽ làm phẳng (flatten) thiết kế DB để tối ưu nhất:

Thiết kế Database (Simplified Entity Relationship):

users: id (PK, Firebase UID), email, display_name, status.

roles: id, name (VD: ADMIN, USER).

user_roles: user_id, role_id (Nối User và Role).

3. Chiến lược Cache (Redis)

Để giải quyết nhược điểm "gọi DB liên tục" của phương pháp lưu Role dưới DB, chúng ta áp dụng Layer Caching với Redis.

Tại sao cần Cache?

Mọi API thao tác (CRUD) đều đi qua Middleware kiểm tra Role. Việc SELECT CSDL liên tục sẽ tạo ra thắt cổ chai (bottleneck). Đọc dữ liệu từ RAM (Redis) nhanh hơn đọc từ Ổ cứng (Database) hàng trăm lần.

Cache đoạn nào và như thế nào?

Dữ liệu được Cache: Lưu trữ dạng Key-Value trong Redis.

Key: user:roles:{uid} (Ví dụ: user:roles:abc123xyz)

Value: Mảng các Role (Ví dụ: ["ADMIN"] hoặc ["USER"]).

Luồng Middleware (AclMiddleware):

Bước 1: Đọc Role từ Redis bằng key user:roles:{uid}.

Bước 2 (Cache Hit): Nếu có data, dùng luôn Role này để kiểm tra quyền -> Đi tiếp vào Controller.

Bước 3 (Cache Miss): Nếu Redis không có, query vào Database. Lấy được Role, lưu ngược lại vào Redis (Set TTL - Time To Live khoảng 1 giờ) -> Đi tiếp vào Controller.

Xóa Cache (Cache Invalidation) - RẤT QUAN TRỌNG:

Khi Admin A thay đổi Role của User B từ USER lên ADMIN thông qua một API /api/users/B/role.

Sau khi Update CSDL thành công, API này bắt buộc phải gọi lệnh xóa key user:roles:{B_uid} trong Redis.

Ở request tiếp theo của User B, hệ thống sẽ thấy Cache Miss, nó sẽ tự động load lại Role ADMIN mới nhất từ DB lên Cache.

4. Tech Stack Chốt hạ

Frontend: React (Vite / Create React App).

Identity Provider: Firebase Authentication (Client SDK).

Backend API: Node.js + Express.

Firebase Admin SDK: Dùng trên BE để verify token.

Database: PostgreSQL hoặc MySQL.

ORM/Query Builder (Khuyên dùng cho Express): Prisma, Sequelize, hoặc Knex.js.

Caching: Redis.

5. Phác thảo Cấu trúc thư mục (Folder Structure)

5.1. Backend (Express.js)

backend/
├── src/
│   ├── config/          # Cấu hình DB, Redis, Firebase Admin
│   ├── middlewares/
│   │   ├── auth.mdw.js  # Verify Firebase Token -> req.user
│   │   ├── acl.mdw.js   # Lấy Role (từ Redis/DB) & Check Quyền
│   ├── controllers/     # Xử lý logic API (CRUD)
│   ├── services/        # Logic nghiệp vụ gọi DB/Redis
│   ├── routes/          # Định nghĩa API endpoints
│   ├── utils/           # Các hàm hỗ trợ
│   └── app.js           # File khởi chạy Express
└── package.json


5.2. Frontend (React)

frontend/
├── src/
│   ├── api/             # Setup Axios, tự động đính kèm Token
│   ├── components/      # Các component dùng chung (Button, Modal...)
│   ├── config/
│   │   └── firebase.js  # Khởi tạo Firebase Client SDK
│   ├── contexts/        # AuthContext (Chứa state User hiện tại)
│   ├── pages/           # Các trang (Login, Dashboard, Users...)
│   └── App.jsx          # Router & Layout chính
└── package.json

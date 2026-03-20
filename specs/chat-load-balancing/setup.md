# Local Setup: Chat Load Balancing

Hướng dẫn này giúp mày chạy toàn bộ hệ thống chat load balancing trên máy local với **1 Gateway + Nginx + 3 Instance + Redis + PostgreSQL**.

---

## 1. Tổng quan kiến trúc local

Trước khi làm gì, hãy hiểu rõ cái mình đang dựng lên:

```
Browser (FE)
    │
    │  ws://localhost:8080/ws?token=...   ← User kết nối WS vào đây
    ▼
┌─────────────────┐
│    Gateway      │  :8080  (Node.js + ws)
│  giữ WS conns   │
└────────┬────────┘
         │  HTTP POST /internal/ws/*      ← Gateway dịch WS event → HTTP
         ▼
┌─────────────────┐
│      Nginx      │  :80  (load balancer)
│  round-robin    │
└──┬──────┬───┬───┘
   │      │   │
   ▼      ▼   ▼
 Ins-1  Ins-2  Ins-3   :3000 mỗi cái  (Express + Prisma)
   │      │   │
   └──────┴───┘
         │  HTTP POST http://gateway:8080/deliver  ← Instance gọi ngược về Gateway
         ▼
┌─────────────────┐
│      Redis      │  :6379  (ws registry)
└─────────────────┘
┌─────────────────┐
│   PostgreSQL    │  :5432  (messages, users)
└─────────────────┘
```

**Lưu ý quan trọng:**
- Client (browser) chỉ biết đến Gateway — không biết Instance nào đang xử lý
- Nginx **không** đứng trước Gateway, chỉ đứng giữa Gateway và Instance
- Các service giao tiếp với nhau qua Docker internal network bằng **tên service** (ví dụ `http://gateway:8080`), không phải localhost

---

## 2. Cấu trúc thư mục cần có

```
project/
├── gateway/              ← Service mới, cần tạo
│   ├── Dockerfile
│   ├── package.json
│   ├── index.js
│   ├── ws-handler.js
│   ├── conn-registry.js
│   └── deliver.route.js
├── nginx/                ← Cần tạo
│   └── nginx.conf
├── src/                  ← Instance code (đã có)
├── prisma/               ← Schema (đã có)
├── Dockerfile            ← Instance Dockerfile (đã có)
├── docker-compose.yml    ← Sửa lại
└── .env
```

---

## 3. docker-compose.yml

Đây là file quan trọng nhất — định nghĩa toàn bộ hệ thống.

```yaml
services:

  # ─── GATEWAY ──────────────────────────────────────────────────────────────
  gateway:
    build: ./gateway          # build từ thư mục gateway/
    ports:
      - "8080:8080"           # expose ra ngoài để browser connect WS
    environment:
      PORT: 8080
      NGINX_URL: http://nginx:80          # Gateway gọi Instance qua Nginx
    depends_on:
      - nginx
      - redis

  # ─── NGINX (Load Balancer cho Instance pool) ──────────────────────────────
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro   # mount config vào container
    depends_on:
      - instance-1
      - instance-2
      - instance-3
    # Không expose port ra ngoài — chỉ Gateway mới gọi vào Nginx

  # ─── INSTANCE × 3 ─────────────────────────────────────────────────────────
  # Tại sao 3 service riêng thay vì dùng `replicas`?
  # Vì docker-compose (không có Swarm) không hỗ trợ replicas với named services.
  # Dùng 3 service riêng giúp log rõ ràng hơn khi debug (instance-1, instance-2...).

  instance-1:
    build: .                  # build từ root (Dockerfile của Instance)
    environment:
      PORT: 3000
      GATEWAY_URL: http://gateway:8080    # Instance gọi ngược về Gateway qua đây
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_PRIVATE_KEY: ${FIREBASE_PRIVATE_KEY}
      FIREBASE_CLIENT_EMAIL: ${FIREBASE_CLIENT_EMAIL}
    depends_on:
      - redis
      - postgres

  instance-2:
    build: .
    environment:
      PORT: 3000
      GATEWAY_URL: http://gateway:8080
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_PRIVATE_KEY: ${FIREBASE_PRIVATE_KEY}
      FIREBASE_CLIENT_EMAIL: ${FIREBASE_CLIENT_EMAIL}
    depends_on:
      - redis
      - postgres

  instance-3:
    build: .
    environment:
      PORT: 3000
      GATEWAY_URL: http://gateway:8080
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      FIREBASE_PRIVATE_KEY: ${FIREBASE_PRIVATE_KEY}
      FIREBASE_CLIENT_EMAIL: ${FIREBASE_CLIENT_EMAIL}
    depends_on:
      - redis
      - postgres

  # ─── REDIS ────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"           # expose để debug bằng redis-cli từ host

  # ─── POSTGRESQL ───────────────────────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"           # expose để dùng DB client (TablePlus, DBeaver...)
    volumes:
      - postgres_data:/var/lib/postgresql/data   # data persist khi container restart

volumes:
  postgres_data:
```

---

## 4. nginx/nginx.conf

Nginx ở đây đóng vai trò **load balancer** — nhận request từ Gateway và phân phối round-robin sang 3 Instance.

```nginx
upstream instance_pool {
    # Round-robin: request đầu → instance-1, tiếp → instance-2, tiếp → instance-3, rồi lặp lại
    server instance-1:3000;
    server instance-2:3000;
    server instance-3:3000;
}

server {
    listen 80;

    location / {
        proxy_pass http://instance_pool;

        # Forward IP thật của client (không bắt buộc nhưng tốt khi debug)
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }

    # Health check endpoint — Nginx tự gọi để biết Instance còn sống không
    location /health {
        access_log off;       # không log health check để tránh spam
        proxy_pass http://instance_pool;
    }
}
```

**Tại sao dùng tên service (`instance-1`) thay vì IP?**
Trong Docker network, mỗi service có DNS name bằng chính tên service. `instance-1:3000` sẽ tự resolve đúng IP nội bộ của container đó. Dùng IP thì bị thay đổi mỗi lần restart.

---

## 5. .env

Thêm các biến mới vào `.env`:

```env
# PostgreSQL
POSTGRES_USER=homework_user
POSTGRES_PASSWORD=homework_pass
POSTGRES_DB=homework_db

# Firebase (đã có từ trước)
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Frontend — trỏ về Gateway local
VITE_GATEWAY_URL=ws://localhost:8080
```

---

## 6. gateway/Dockerfile

Gateway là service Node.js mới, cần Dockerfile riêng:

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
```

---

## 7. Chạy hệ thống

**Bước 1 — Build tất cả images:**
```bash
docker compose build
```
Lần đầu sẽ lâu vì phải pull base images và install dependencies. Lần sau nhanh hơn nhờ Docker layer cache.

**Bước 2 — Khởi động toàn bộ:**
```bash
docker compose up
```
Hoặc chạy nền (không chiếm terminal):
```bash
docker compose up -d
```

**Bước 3 — Chạy migration DB** (lần đầu, hoặc khi schema thay đổi):
```bash
# Chạy migration vào đúng 1 instance thôi — 3 cái share cùng 1 DB
docker compose exec instance-1 npx prisma migrate deploy
```

**Bước 4 — Kiểm tra tất cả service đã chạy chưa:**
```bash
docker compose ps
```
Mong đợi thấy tất cả service ở trạng thái `running`.

---

## 8. Verify hệ thống hoạt động đúng

### 8.1 Kiểm tra Nginx đang route đúng 3 instance

Instance cần có endpoint `GET /health` trả về tên của mình — để ta biết request đang vào instance nào:

```js
// Thêm vào Instance (src/app.js hoặc tương đương)
app.get('/health', (req, res) => {
  res.json({ instance: process.env.HOSTNAME })
})
```

Sau đó test từ bên trong Gateway container (vì Nginx không expose port ra ngoài):

```bash
# Gọi 6 lần qua Nginx — phải thấy 3 hostname khác nhau luân phiên
for i in {1..6}; do
  docker compose exec gateway wget -qO- http://nginx:80/health
done
```

Kết quả mong đợi (round-robin):
```
{"instance":"abc123"}   ← instance-1
{"instance":"def456"}   ← instance-2
{"instance":"ghi789"}   ← instance-3
{"instance":"abc123"}   ← instance-1 (lặp lại)
...
```

### 8.2 Kiểm tra Gateway đang chạy

```bash
docker compose logs gateway --follow
```

### 8.3 Xem log từng Instance riêng lẻ

```bash
# Xem log instance-1 (thay số để xem cái khác)
docker compose logs instance-1 --follow

# Xem log tất cả instance cùng lúc
docker compose logs instance-1 instance-2 instance-3 --follow
```

### 8.4 Test WS connection thực sự

Dùng tool `wscat` để kết nối WS từ terminal — không cần mở browser:

```bash
# Cài wscat (1 lần)
npm install -g wscat

# Connect thử — thay <firebase_token> bằng token thật
wscat -c "ws://localhost:8080/ws?token=<firebase_token>"
```

Nếu connect thành công, terminal sẽ hiện `Connected (press CTRL+C to quit)`.
Nếu thấy `error: Connection refused` → Gateway chưa chạy.
Nếu thấy close code `4001` → token invalid.

### 8.5 Kiểm tra Redis registry sau khi có user connect

```bash
# Mở redis-cli
docker compose exec redis redis-cli

# Sau khi user connect WS, check xem có entry không
KEYS ws:registry:*

# Xem nội dung của 1 entry
GET ws:registry:<userId>
```

Kết quả mong đợi:
```json
[{"connId":"abc123","gatewayUrl":"http://gateway:8080"}]
```

---

## 9. Các lệnh thường dùng khi dev

```bash
# Dừng tất cả (giữ data)
docker compose stop

# Dừng và xóa container (giữ volume — data DB không mất)
docker compose down

# Dừng và xóa cả volume (reset sạch DB)
docker compose down -v

# Restart 1 service cụ thể (ví dụ sau khi sửa code gateway)
docker compose restart gateway

# Rebuild và restart 1 service (sau khi sửa code)
docker compose up -d --build gateway

# Xem tất cả log từ đầu
docker compose logs

# Theo dõi log realtime
docker compose logs --follow
```

---

## 10. Thứ tự khởi động (để hiểu depends_on)

`depends_on` trong docker-compose chỉ đảm bảo **container start trước**, không đảm bảo **service bên trong đã sẵn sàng**. Thứ tự thực tế:

```
postgres, redis          ← start trước (không depends ai)
    │
    ▼
instance-1/2/3           ← start sau postgres + redis
    │
    ▼
nginx                    ← start sau 3 instances
    │
    ▼
gateway                  ← start cuối cùng
```

Nếu thấy lỗi "connection refused" lúc start lần đầu, chờ vài giây rồi restart service bị lỗi:
```bash
docker compose restart gateway
```

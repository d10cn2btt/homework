# Technical Notes

## 1. Authentication & Token Storage (Firebase)

### Token được lưu ở đâu?

Token **không do code tự lưu** — Firebase SDK tự động quản lý và lưu vào **IndexedDB** của trình duyệt.

```
IndexedDB → firebaseLocalStorageDb → firebaseLocalStorage
```

> Kiểm tra: DevTools → Application → IndexedDB → `firebaseLocalStorageDb`

---

### Flow thực tế trong dự án

#### Bước 1 — Khởi tạo Firebase (`src/config/firebase.js`)

```js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Firebase tự gắn persistence vào IndexedDB

export { auth };
```

#### Bước 2 — Đăng nhập (`src/pages/LoginPage.jsx`)

```js
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';

async function handleSubmit(e) {
  e.preventDefault();
  // Firebase xác thực với server, nhận token, tự lưu vào IndexedDB
  await signInWithEmailAndPassword(auth, email.trim(), password);
  navigate('/dashboard', { replace: true });
}
```

> Sau khi `signInWithEmailAndPassword` thành công, Firebase **tự động** lưu token vào IndexedDB — lập trình viên không cần làm gì thêm.

#### Bước 3 — Khôi phục session sau F5 (`src/contexts/AuthContext.jsx`)

```js
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';

useEffect(() => {
  // Listener này chạy ngay khi app mount
  // Firebase đọc token từ IndexedDB và trả về firebaseUser nếu còn hợp lệ
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // Sync thêm thông tin (roles, display_name...) từ backend của mình
      const res = await api.post('/auth/sync');
      setCurrentUser(res.data);
      setUserRoles(res.data.roles || []);
    } else {
      setCurrentUser(null);
      setUserRoles([]);
    }
    setLoading(false);
  });

  return unsubscribe; // Cleanup listener khi component unmount
}, []);
```

#### Bước 4 — Gắn token vào mọi API request (`src/api/axios.js`)

```js
import axios from 'axios';
import { auth } from '../config/firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
});

// Interceptor: tự động lấy token mới nhất và gắn vào header trước mỗi request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(); // Tự refresh token nếu hết hạn
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

> `getIdToken()` thông minh: nếu token sắp hết hạn, nó tự động gọi Firebase để lấy token mới mà không cần logout/login lại.

#### Bước 5 — Đăng xuất (`src/contexts/AuthContext.jsx`)

```js
async function signOut() {
  await firebaseSignOut(auth); // Firebase xóa token khỏi IndexedDB
  setCurrentUser(null);
  setUserRoles([]);
}
```

---

### Tóm tắt toàn bộ flow

```
[LoginPage]
  signInWithEmailAndPassword()
        │
        ▼
[Firebase SDK] ──lưu token──► [IndexedDB: firebaseLocalStorageDb]
        │
        ▼
[AuthContext] onAuthStateChanged() ──đọc token từ IndexedDB──► firebaseUser
        │
        ▼
[api/axios.js] interceptor ──gắn token──► Authorization: Bearer <token>
        │
        ▼
[Backend] verifyIdToken() ──xác thực──► trả về user data
```

---

## 2. Browser Storage — Tổng quan

```
Browser Storage
├── Cookie
├── localStorage
├── sessionStorage
├── IndexedDB
└── Cache API (Service Worker)
```

### Bảng so sánh

| | Cookie | localStorage | sessionStorage | IndexedDB | Cache API |
|---|---|---|---|---|---|
| **Dung lượng** | ~4KB | ~5-10MB | ~5-10MB | Vài trăm MB+ | Vài trăm MB+ |
| **Kiểu dữ liệu** | String | String | String | Mọi JS object | Request/Response |
| **Tự gửi lên server** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Tồn tại sau F5** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tồn tại sau đóng tab** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Tồn tại sau đóng browser** | ✅ (nếu có expiry) | ✅ | ❌ | ✅ | ✅ |
| **Async** | ❌ | ❌ (block) | ❌ (block) | ✅ | ✅ |

---

### 🍪 Cookie

**Ưu điểm:**
- Tự động đính kèm vào mọi HTTP request
- Flag bảo mật: `HttpOnly` (JS không đọc được → chống XSS), `Secure`, `SameSite` (chống CSRF)
- Có thể set expiry date

**Nhược điểm:**
- Dung lượng rất nhỏ (~4KB)
- Tự gửi lên server mỗi request → lãng phí bandwidth nếu lưu nhiều

**Dùng khi:** Token auth cần bảo mật cao với server-side session

```js
// ❌ KHÔNG LÀM THẾ NÀY — lưu token trong cookie bằng JS là mất HttpOnly
document.cookie = 'token=abc123; path=/';

// ✅ Nên để server set cookie (HttpOnly) qua response header
// Set-Cookie: token=abc123; HttpOnly; Secure; SameSite=Strict

// Đọc cookie không HttpOnly
const token = document.cookie
  .split('; ')
  .find(row => row.startsWith('theme='))
  ?.split('=')[1];
```

---

### 🗄️ localStorage

**Ưu điểm:**
- Đơn giản, API dễ dùng
- Persist lâu dài (không mất khi đóng browser)

**Nhược điểm:**
- Sync (block main thread)
- Chỉ lưu được String
- Dễ bị đọc bởi XSS → **không lưu token nhạy cảm**

**Dùng khi:** User preferences (dark mode, language), dữ liệu nhỏ không nhạy cảm

```js
// Lưu user preference (phù hợp dùng localStorage)
localStorage.setItem('theme', 'dark');
localStorage.setItem('language', 'vi');

// Đọc
const theme = localStorage.getItem('theme'); // 'dark'

// Lưu object (phải JSON.stringify)
localStorage.setItem('userSettings', JSON.stringify({ fontSize: 16, sidebar: true }));
const settings = JSON.parse(localStorage.getItem('userSettings'));

// Xóa
localStorage.removeItem('theme');
localStorage.clear(); // xóa tất cả
```

---

### 🔖 sessionStorage

**Ưu điểm:**
- Tự xóa khi đóng tab → phù hợp dữ liệu tạm
- Tách biệt giữa các tab

**Nhược điểm:**
- Mất khi đóng tab
- Không share được giữa các tab

**Dùng khi:** Form data tạm thời, multi-step wizard, dữ liệu chỉ cần trong 1 phiên tab

```js
// Lưu progress của multi-step form khi user điền dang dở
sessionStorage.setItem('postDraft', JSON.stringify({
  title: 'Bài viết mới',
  content: 'Nội dung...',
  step: 2,
}));

// Khi user F5 → vẫn còn draft, khi đóng tab → mất (đúng mong muốn)
const draft = JSON.parse(sessionStorage.getItem('postDraft'));

// Xóa sau khi submit form xong
sessionStorage.removeItem('postDraft');
```

---

### 🗃️ IndexedDB

**Ưu điểm:**
- Dung lượng lớn (vài trăm MB đến vài GB)
- Lưu được mọi kiểu JS object, blob, binary
- Async → không block UI
- Có index để query theo field

**Nhược điểm:**
- API gốc rất phức tạp (thường dùng qua thư viện `idb`, `Dexie`, hoặc Firebase SDK lo hết)

**Dùng khi:** Firebase token (tự động), offline data, lưu file/blob lớn, PWA

```js
// Firebase tự dùng IndexedDB — bạn không cần viết gì
// Token được lưu tự động sau signInWithEmailAndPassword()

// Nếu tự dùng IndexedDB, nên dùng thư viện `idb` cho đơn giản:
import { openDB } from 'idb';

const db = await openDB('myApp', 1, {
  upgrade(db) {
    db.createObjectStore('posts', { keyPath: 'id' });
  },
});

// Lưu
await db.put('posts', { id: 1, title: 'Hello', content: '...' });

// Đọc
const post = await db.get('posts', 1);

// Lấy tất cả
const allPosts = await db.getAll('posts');
```

---

### ⚡ Cache API (Service Worker)

**Ưu điểm:**
- Cache được HTTP response (HTML, JS, CSS, images)
- App hoạt động được khi offline

**Nhược điểm:**
- Yêu cầu Service Worker → phức tạp hơn
- Không phù hợp lưu dữ liệu có cấu trúc

**Dùng khi:** PWA, offline-first apps, cache static assets

```js
// Trong Service Worker (sw.js)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Trả về cache nếu có, không thì fetch từ network
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open('v1').then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
```

---

### Quick Cheat Sheet

```
Token auth (bảo mật cao, server set)   → Cookie (HttpOnly + Secure + SameSite)
Token auth (SPA + Firebase)            → Firebase tự dùng IndexedDB ✅ (dự án này)
User preferences (theme, language)     → localStorage
Form draft / wizard step               → sessionStorage
Dữ liệu lớn / offline / binary         → IndexedDB
Cache assets/pages cho offline          → Cache API
```

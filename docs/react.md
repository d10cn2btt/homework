# React — Luồng code & kỹ thuật sử dụng

## Luồng code từ file đến file — Code chạy như thế nào?

```
index.html
    │  Browser load file này đầu tiên
    │  Chỉ có 1 thẻ <div id="root"></div> — trống rỗng
    │  + <script src="/src/main.jsx"> → Vite inject toàn bộ JS vào đây
    ▼
main.jsx
    │  ReactDOM.createRoot(document.getElementById('root'))
    │  → Tìm thẻ <div id="root"> trong index.html
    │  → "Chiếm quyền" thẻ đó, từ giờ React quản lý nội dung bên trong
    │  .render(<App />)
    │  → Bắt đầu render component App vào trong #root
    ▼
App.jsx
    │  Bọc toàn bộ app trong 2 lớp:
    │  <AuthProvider>    ← quản lý auth state toàn app
    │    <BrowserRouter> ← quản lý URL/routing
    │      <AppRoutes /> ← chứa tất cả <Route>
    │    </BrowserRouter>
    │  </AuthProvider>
    ▼
AuthContext.jsx  (AuthProvider)
    │  Khởi tạo state: currentUser, loading, userRoles
    │  Chạy useEffect → onAuthStateChanged → kiểm tra Firebase session
    │  Provide { currentUser, isAdmin, loading, signOut } cho toàn bộ cây bên dưới
    ▼
App.jsx  (AppRoutes — BrowserRouter đọc URL hiện tại)
    │
    │  URL = /login        → render <LoginPage />
    │  URL = /dashboard    → render <ProtectedRoute> → <DashboardPage />
    │  URL = /admin/users  → render <ProtectedRoute> → <AdminRoute> → <UsersPage />
    │  URL = *             → render <ErrorPage code={404} />
    ▼
ProtectedRoute.jsx
    │  Đọc { currentUser, loading } từ AuthContext
    │  loading=true     → render <LoadingSpinner />    (đang chờ Firebase)
    │  currentUser=null → <Navigate to="/login" />    (chưa đăng nhập)
    │  currentUser có   → render children             (pass ✅)
    ▼
[PageComponent].jsx  (VD: DashboardPage, PostsPage...)
    │  Đây mới là UI thật được render ra màn hình
    ▼
Browser hiển thị UI ✅
```

**Tóm tắt bằng hình ảnh:**

```
index.html       ← Bộ khung HTML trống, chỉ có <div id="root">
    │ Vite inject JS
main.jsx         ← Điểm khởi động, mount React vào #root
    │
App.jsx          ← Cấu hình toàn app: Auth + Router + Routes
    │
    ├── AuthProvider      ← "Kho" chứa thông tin user cho toàn app
    ├── BrowserRouter     ← Cho phép điều hướng không reload trang
    ├── ProtectedRoute    ← Cổng bảo vệ: chặn user chưa đăng nhập
    ├── AdminRoute        ← Cổng bảo vệ: chặn user không phải admin
    └── [PageComponent]   ← UI thật: LoginPage, DashboardPage, PostsPage...
```

---

## BrowserRouter — Tác dụng là gì?

Bình thường khi gõ `/dashboard` trên thanh địa chỉ, browser sẽ **gửi request lên server**
để lấy trang `/dashboard`. BrowserRouter **đánh chặn** hành động đó lại:

```
Không có BrowserRouter (website truyền thống):
  User gõ /dashboard → Browser gửi GET /dashboard lên server
                      → Server trả về trang mới (hoặc 404)
                      → Trang reload lại từ đầu

Có BrowserRouter (SPA - Single Page Application):
  User gõ /dashboard → BrowserRouter chặn lại, KHÔNG gửi lên server
                      → Chỉ thay đổi URL trên thanh địa chỉ
                      → React tự render đúng component tương ứng
                      → Không reload trang ✅
```

> **SPA** = chỉ load HTML **một lần duy nhất**, mọi điều hướng sau đó
> là React tự xử lý trong bộ nhớ — nhanh hơn và mượt hơn.

Tất cả cách điều hướng trong app đều thông qua BrowserRouter:

```jsx
<Link to="/posts">Bài viết</Link>   // click → đổi URL, React render PostsPage
<Navigate to="/login" replace />    // redirect tự động, không reload trang
navigate('/dashboard')              // điều hướng bằng code sau khi login xong
```

---

## ProtectedRoute & AdminRoute — Tác dụng là gì?

Nếu không có ProtectedRoute, user có thể gõ thẳng `/dashboard` trên trình duyệt
và truy cập được dù **chưa đăng nhập**.

```jsx
// Không có ProtectedRoute — ai cũng vào được
<Route path="/dashboard" element={<DashboardPage />} />

// Có ProtectedRoute — phải qua "cổng bảo vệ" trước
<Route path="/dashboard" element={
  <ProtectedRoute>        // ← kiểm tra đăng nhập
    <DashboardPage />     // ← nếu pass mới render cái này
  </ProtectedRoute>
} />
```

**Logic bên trong ProtectedRoute:**

```js
export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading)      return <LoadingSpinner />;       // Firebase đang kiểm tra session
  if (!currentUser) return <Navigate to="/login" />; // chưa đăng nhập → đá ra
  return children;                                    // đã đăng nhập → vào được ✅
}
```

**AdminRoute** là lớp bảo vệ thứ 2 — chỉ cho ADMIN vào:

```js
export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading)   return <LoadingSpinner />;
  if (!isAdmin)  return <Navigate to="/403" replace />; // không phải admin → 403
  return children;
}
```

**Khi lồng 2 lớp bảo vệ vào nhau:**

```
URL: /admin/users
    │
    ▼
ProtectedRoute  → "Mày có đăng nhập không?"
    │ ✅ rồi
    ▼
AdminRoute      → "Mày có phải ADMIN không?"
    │ ✅ rồi
    ▼
UsersPage       → render UI trang quản lý user ✅

── Nếu chưa đăng nhập ─────────────────────
ProtectedRoute → redirect /login

── Nếu đăng nhập nhưng không phải admin ───
ProtectedRoute → pass ✅
AdminRoute     → redirect /403
```

---

## Kỹ thuật 1: useState — lưu dữ liệu trong component

`useState` cho phép component "nhớ" dữ liệu. Khi state thay đổi → component tự render lại.

```js
const [email, setEmail] = useState('');        // ban đầu = chuỗi rỗng
const [loading, setLoading] = useState(false); // ban đầu = false
const [error, setError] = useState('');
```

**Ví dụ trong LoginPage:**
```js
// Khi user gõ vào input → cập nhật state
<input value={email} onChange={(e) => setEmail(e.target.value)} />

// Khi đang gọi API → bật loading, disable nút
setLoading(true);
await signInWithEmailAndPassword(...);
setLoading(false);
```

---

## Kỹ thuật 2: useEffect — chạy code khi component mount / state thay đổi

`useEffect` chạy **sau khi render**. Dùng để gọi API, subscribe event, v.v.

```js
useEffect(() => {
  // code chạy ở đây

  return () => {
    // cleanup khi component bị unmount (tuỳ chọn)
  };
}, [/* dependency array */]);
```

- `[]` rỗng → chỉ chạy **1 lần** khi component mount
- `[someVar]` → chạy lại mỗi khi `someVar` thay đổi

**Trong AuthContext — lắng nghe trạng thái đăng nhập Firebase:**
```js
useEffect(() => {
  // onAuthStateChanged trả về hàm unsubscribe
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // user vừa đăng nhập → sync với backend
      const res = await api.post('/auth/sync');
      setCurrentUser(res.data);
    } else {
      // user vừa đăng xuất
      setCurrentUser(null);
    }
  });

  return unsubscribe; // cleanup: huỷ lắng nghe khi component unmount
}, []); // [] = chỉ chạy 1 lần khi app khởi động
```

---

## Kỹ thuật 3: Context API — chia sẻ state toàn app

Vấn đề: nhiều component cần biết "user đang đăng nhập là ai". Nếu truyền qua props từng cấp rất rắc rối.

Giải pháp: **Context** — tạo một "kho" dữ liệu dùng chung, component nào cần thì lấy.

**Tạo context + Provider:**
```js
// AuthContext.jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  // ... logic lấy user

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, signOut }}>
      {children}  {/* tất cả component con đều truy cập được */}
    </AuthContext.Provider>
  );
}
```

**Bọc toàn app bằng Provider:**
```js
// App.jsx
<AuthProvider>
  <BrowserRouter>...</BrowserRouter>
</AuthProvider>
```

**Bất kỳ component con nào cũng lấy được:**
```js
const { currentUser, isAdmin } = useAuth(); // dùng ở bất kỳ đâu
```

---

## Kỹ thuật 4: Custom Hook — đóng gói logic tái sử dụng

### Tại sao Hook phải bắt đầu bằng `use`?

Đây là **quy định bắt buộc của React** — không phải convention tùy thích.

React cần phân biệt đâu là Hook, đâu là function thường — vì Hook có **quy tắc đặc biệt** mà function thường không có. React nhận diện dựa vào **tên hàm**:

```js
// React biết đây là Hook → áp dụng quy tắc Hook
function useAuth() { ... }
function useState() { ... }
function useEffect() { ... }

// React biết đây là function thường → không áp dụng quy tắc Hook
function getUser() { ... }
function formatDate() { ... }
```

### Rules of Hooks — 2 quy tắc cứng

Hooks có **2 quy tắc** mà function thường không bị ràng buộc:

```js
// ✅ ĐÚNG — Hook phải gọi ở top level, luôn chạy, không có điều kiện
function MyComponent() {
  const [count, setCount] = useState(0);
  const { user } = useAuth();
}

// ❌ SAI — Hook không được gọi bên trong if/loop/function con
function MyComponent() {
  if (isLoggedIn) {
    const [count, setCount] = useState(0); // BUG: không được gọi có điều kiện
  }
}
```

> **Lý do:** React tracking thứ tự gọi Hook để quản lý state.
> Nếu gọi có điều kiện, thứ tự thay đổi → React bị lẫn lộn state giữa các lần render → bug khó tìm.

### ESLint tự động cảnh báo nhờ vào tên `use`

`eslint-plugin-react-hooks` chỉ kiểm tra được Rules of Hooks khi tên bắt đầu bằng `use`:

```js
function useAuth() {
  if (condition) {
    useEffect(...); // ← ESLint báo lỗi ngay: "Hook called conditionally" ✅
  }
}

function getAuth() {
  if (condition) {
    useEffect(...); // ← ESLint KHÔNG báo lỗi vì không nhận ra đây là Hook
  }               //   → Bug âm thầm, khó debug 🐛
}
```

> Nếu đặt tên `getAuth()` thay vì `useAuth()`, code vẫn chạy — nhưng **mất hết cảnh báo**, lỗi sẽ âm thầm xuất hiện.

### Lợi ích thực tế: tái sử dụng logic

Custom hook giúp **gom logic có state/side-effect vào 1 chỗ**:

```js
// ❌ Không có custom hook — lặp code ở mọi component
function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/posts')
      .then(res => setPosts(res.data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);
  // ...
}

function DashboardPage() {
  // lại viết y chang 15 dòng trên... 😩
}
```

```js
// ✅ Có custom hook — viết 1 lần, dùng ở bất kỳ đâu
function usePosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/posts')
      .then(res => setPosts(res.data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  return { posts, loading, error };
}

// Dùng ở bất kỳ đâu, gọn gàng
function PostsPage() {
  const { posts, loading, error } = usePosts(); // 1 dòng thay vì 15 dòng ✅
}
function DashboardPage() {
  const { posts } = usePosts(); // tái sử dụng ngay ✅
}
```

**Trong dự án — `useAuth()` làm đúng việc này:**

```js
// Thay vì mỗi component viết:
const context = useContext(AuthContext);

// Tạo custom hook 1 lần trong AuthContext.jsx:
export function useAuth() {
  return useContext(AuthContext);
}

// Dùng ở mọi nơi (NavBar, ProtectedRoute, AdminRoute, ProfilePage...):
const { currentUser, isAdmin, signOut } = useAuth();
```

### Tóm tắt

| | Giải thích |
|---|---|
| **Tại sao phải `use`?** | React dùng tên để nhận diện Hook và enforce Rules of Hooks |
| **ESLint dùng tên** | `eslint-plugin-react-hooks` chỉ cảnh báo đúng nếu tên bắt đầu `use` |
| **Nếu không đặt `use`** | Code vẫn chạy, nhưng mất hết cảnh báo → bug âm thầm, khó debug |
| **Lợi ích custom hook** | Gom logic có state/effect vào 1 chỗ, tái sử dụng nhiều nơi |

---

## Kỹ thuật 5: React Router — điều hướng trang

**Khai báo routes trong App.jsx:**
```js
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/posts/:id" element={<PostDetailPage />} />  {/* :id là param động */}
</Routes>
```

**Điều hướng bằng code (sau khi login xong):**
```js
const navigate = useNavigate();
navigate('/dashboard', { replace: true }); // replace: không thể back về /login
```

**Link thay thế thẻ `<a>` — không reload trang:**
```js
<Link to="/posts">Bài viết</Link>
```

**Redirect khi chưa đăng nhập:**
```js
<Navigate to="/login" replace />
```

---

## Kỹ thuật 6: Component bọc (Wrapper Component)

Component nhận `children` và quyết định có render không — dùng để bảo vệ route.

**ProtectedRoute** — chặn user chưa đăng nhập:
```js
export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) return <LoadingSpinner />;            // đang kiểm tra → hiện spinner
  if (!currentUser) return <Navigate to="/login" />; // chưa đăng nhập → về login

  return children; // ok → render trang thật
}
```

**AdminRoute** — chặn user không phải admin:
```js
export default function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/403" />;
  return children;
}
```

**Dùng trong App.jsx — lồng nhau:**
```jsx
<ProtectedRoute>       {/* kiểm tra đăng nhập trước */}
  <AdminRoute>         {/* rồi kiểm tra quyền admin */}
    <UsersPage />
  </AdminRoute>
</ProtectedRoute>
```

---

## Kỹ thuật 7: Axios Interceptor — tự động gắn token

Thay vì mỗi API call phải tự lấy token và gắn vào header, dùng **interceptor** để làm tự động:

```js
// api/axios.js — cấu hình 1 lần
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(); // lấy token Firebase
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config; // tiếp tục gửi request
});

// Kết quả: mọi nơi gọi api.get/post đều tự có token, không cần làm gì thêm
const res = await api.get('/users'); // token được gắn tự động
```

---

## Flow 1: User đăng nhập lần đầu

```
[User] nhập email + password → bấm "Đăng nhập"
    │
    ▼
[LoginPage] handleSubmit()
    ├─ e.preventDefault()          → ngăn browser reload trang
    ├─ validate email, password
    ├─ setLoading(true)            → nút "Đăng nhập" bị disabled
    └─ signInWithEmailAndPassword(auth, email, password)
              │
              ▼
[Firebase Server] xác thực email/password
              │
        ✅ Thành công
              │
              ▼
[Firebase SDK] lưu token vào IndexedDB
    + kích hoạt tất cả listener onAuthStateChanged
              │
              ▼
[AuthContext] onAuthStateChanged callback(firebaseUser)
    ├─ firebaseUser có giá trị → gọi api.post('/auth/sync')
    │       │
    │       ▼ [axios interceptor tự động gắn Bearer token vào header]
    │       │
    │       ▼
    │  [Backend] verifyIdToken() → trả về { id, email, display_name, roles }
    │       │
    │       ▼
    ├─ setCurrentUser(res.data)    → currentUser = { id, email, ... }
    ├─ setUserRoles(res.data.roles)→ userRoles = ['ADMIN'] hoặc ['USER']
    └─ setLoading(false)
              │
              ▼
[LoginPage] navigate('/dashboard', { replace: true })
    → URL chuyển sang /dashboard, không thể back về /login
              │
              ▼
[App.jsx] match route /dashboard → render <ProtectedRoute><DashboardPage /></ProtectedRoute>
              │
              ▼
[ProtectedRoute]
    ├─ loading = false ✅
    ├─ currentUser != null ✅
    └─ return children → render DashboardPage
              │
              ▼
[NavBar] currentUser.display_name hiển thị tên user
         isAdmin = true → hiện link "Quản lý người dùng"
```

---

## Flow 2: F5 / Reload trang (restore session)

Đây là flow quan trọng nhất — lý do tại sao F5 không bị logout.

```
[Browser] reload trang
    │
    ▼
[main.jsx] render <App /> từ đầu — mọi state JS bị reset về giá trị ban đầu
    │
    ▼
[AuthProvider] mount lần đầu
    ├─ currentUser = null   (state ban đầu)
    ├─ userRoles   = []
    └─ loading     = true   ← QUAN TRỌNG: chặn render page ngay
    │
    ▼
[useEffect] chạy — đăng ký onAuthStateChanged listener
    │
    ▼
[Firebase SDK] đọc IndexedDB → tìm thấy token cũ còn hợp lệ
    │
    ▼
[onAuthStateChanged callback] được gọi ngay với firebaseUser hợp lệ
    ├─ gọi api.post('/auth/sync') → lấy lại user data từ backend
    ├─ setCurrentUser(res.data)
    └─ setLoading(false)    ← "bật đèn xanh" cho ProtectedRoute
    │
    ▼
[ProtectedRoute] re-render vì loading thay đổi
    ├─ loading = false ✅
    ├─ currentUser != null ✅
    └─ render trang bình thường ✅

── Nếu không có loading=true ban đầu ──────────────────────────────
    [ProtectedRoute] render ngay khi mount:
        ├─ loading = false
        ├─ currentUser = null  ← Firebase chưa kịp đọc IndexedDB!
        └─ → redirect /login   ← BUG: bị kick ra login dù đã login rồi 🐛
────────────────────────────────────────────────────────────────────
```

---

## Flow 3: Logout

```
[User] bấm nút "Đăng xuất"
    │
    ▼
[NavBar] gọi signOut() từ useAuth()
    │
    ▼
[AuthContext] signOut()
    ├─ firebaseSignOut(auth)  → Firebase xóa token khỏi IndexedDB
    │       │
    │       ▼
    │  onAuthStateChanged callback được gọi với firebaseUser = null
    │  (nhưng setCurrentUser(null) bên dưới chạy trước để UI update ngay)
    │
    ├─ setCurrentUser(null)   → UI cập nhật ngay lập tức
    └─ setUserRoles([])
    │
    ▼
[NavBar] currentUser = null → return null (NavBar ẩn đi)
    │
    ▼
[ProtectedRoute] currentUser = null → <Navigate to="/login" replace />
    │
    ▼
[Browser] URL chuyển về /login, render LoginPage
```

---

## Flow 4: Truy cập route bị chặn

### Trường hợp A — Chưa đăng nhập, truy cập `/dashboard`

```
[User chưa login] gõ thẳng URL /dashboard
    │
    ▼
[App.jsx] match route → render <ProtectedRoute><DashboardPage /></ProtectedRoute>
    │
    ▼
[ProtectedRoute]
    ├─ loading = false (không có session → onAuthStateChanged trả null nhanh)
    ├─ currentUser = null ❌
    └─ return <Navigate to="/login" replace />
    │
    ▼
[Browser] chuyển về /login
```

### Trường hợp B — Đã login nhưng không phải Admin, truy cập `/admin/users`

```
[User thường] truy cập /admin/users
    │
    ▼
[App.jsx] render <ProtectedRoute><AdminRoute><UsersPage /></AdminRoute></ProtectedRoute>
    │
    ▼
[ProtectedRoute] currentUser có → pass ✅
    │
    ▼
[AdminRoute]
    ├─ isAdmin = false ❌  (userRoles không có 'ADMIN')
    └─ return <Navigate to="/403" replace />
    │
    ▼
[Browser] chuyển về /403 → render <ErrorPage code={403} />
```

---

## Flow 5: Component Tree & State Flow

Sơ đồ component tree và dữ liệu chảy như thế nào:

```
<AuthProvider>  ← nắm giữ: currentUser, userRoles, loading, signOut()
    │
    ├── <BrowserRouter>
    │       │
    │       ├── <NavBar>
    │       │     useAuth() → { currentUser, isAdmin, signOut }
    │       │     Hiển thị: tên user, link admin (nếu isAdmin), nút logout
    │       │
    │       └── <Routes>
    │               │
    │               ├── /login → <LoginPage />
    │               │     (không cần auth, nhưng nếu đã login → redirect /dashboard)
    │               │
    │               ├── /dashboard → <ProtectedRoute>
    │               │                   useAuth() → { currentUser, loading }
    │               │                   <DashboardPage />
    │               │
    │               ├── /posts/:id → <ProtectedRoute>
    │               │                   <PostDetailPage />
    │               │
    │               └── /admin/users → <ProtectedRoute>
    │                                     <AdminRoute>
    │                                         useAuth() → { isAdmin }
    │                                         <UsersPage />
    │                                     </AdminRoute>
    │                                 </ProtectedRoute>
    │
    └── [State thay đổi ở AuthProvider → tất cả component dùng useAuth() re-render]
```

**Quy tắc re-render:**

```
setCurrentUser() được gọi
    │
    ▼
AuthProvider re-render → tạo value object mới
    │
    ▼
Mọi component đang dùng useAuth() đều re-render:
    ├── NavBar         → cập nhật tên user, hiện/ẩn link admin
    ├── ProtectedRoute → kiểm tra lại currentUser, quyết định render hay redirect
    └── AdminRoute     → kiểm tra lại isAdmin
```

---

## Flow 6: Vòng đời render của React (Lifecycle)

```
Component được tạo (Mount)
    │
    ▼
1. Render lần 1:
   - Chạy function component
   - useState khởi tạo giá trị ban đầu
   - Trả về JSX → React cập nhật DOM
    │
    ▼
2. useEffect chạy (sau khi DOM sẵn sàng):
   - Gọi API, đăng ký listener, subscribe event...
    │
    ▼
State/Props thay đổi (Update)
    │
    ▼
3. Render lại:
   - Chạy lại function component
   - useState giữ nguyên giá trị cũ (không reset)
   - Trả về JSX mới → React so sánh diff → cập nhật DOM tối thiểu
    │
    ▼
4. useEffect chạy lại (nếu dependency thay đổi)
    │
    ▼
Component bị xóa (Unmount)
    │
    ▼
5. useEffect cleanup chạy:
   - Hủy listener, clear timer, cancel request...
```

**Ví dụ thực tế trong dự án:**

```
[AuthProvider mount]
    → useState: currentUser=null, loading=true     ← Render lần 1
    → DOM: spinner hiển thị (loading=true)
    → useEffect: đăng ký onAuthStateChanged()

[Firebase trả về firebaseUser]
    → setCurrentUser(data), setLoading(false)      ← Trigger render lại
    → Render lần 2: currentUser có giá trị
    → DOM: spinner ẩn, page thật hiện ra

[User logout]
    → setCurrentUser(null)                         ← Trigger render lại
    → Render lần 3: currentUser = null
    → DOM: NavBar ẩn, redirect về /login

[AuthProvider unmount (hiếm gặp)]
    → useEffect cleanup: unsubscribe()             ← Hủy Firebase listener
```

# React — Luồng code & kỹ thuật sử dụng

## Luồng ứng dụng khởi động

```
main.jsx: render <App />
  → App.jsx: bọc AuthProvider + BrowserRouter
  → AuthProvider: lắng nghe Firebase auth state
  → BrowserRouter: đọc URL hiện tại
  → AppRoutes: chọn đúng Page component để render
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

Hook là hàm bắt đầu bằng `use`. Custom hook giúp gộp logic lại thành 1 chỗ.

```js
// Thay vì mỗi component viết:
const context = useContext(AuthContext);

// Tạo custom hook 1 lần:
export function useAuth() {
  return useContext(AuthContext);
}

// Dùng ở mọi nơi:
const { currentUser, isAdmin } = useAuth();
```

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

## Tóm tắt luồng thực tế: User đăng nhập

```
1. User nhập email/pass → bấm "Đăng nhập"
   ↓
2. LoginPage.handleSubmit:
   - e.preventDefault() — ngăn trang reload
   - setLoading(true) — disable nút
   - signInWithEmailAndPassword(auth, email, password)
   ↓
3. Firebase xác thực thành công → kích hoạt onAuthStateChanged
   ↓
4. AuthContext.useEffect:
   - Nhận firebaseUser từ Firebase
   - Gọi api.post('/auth/sync') — axios interceptor tự gắn token
   - Nhận về { id, email, display_name, roles }
   - setCurrentUser(res.data), setUserRoles(res.data.roles)
   ↓
5. LoginPage: navigate('/dashboard')
   ↓
6. App.jsx render DashboardPage (bọc bởi ProtectedRoute)
   - ProtectedRoute: currentUser có rồi → render bình thường
   ↓
7. NavBar: isAdmin = true → hiện link "Quản lý người dùng"
```

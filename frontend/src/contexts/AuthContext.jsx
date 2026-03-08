import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import api from '../api/axios';

// Context object — sẽ được inject vào toàn bộ component tree bên dưới AuthProvider
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);

  // loading = true ban đầu để "chặn" render cho đến khi Firebase kiểm tra
  // xong trạng thái auth (đọc từ IndexedDB). Nếu không có flag này:
  //   → currentUser sẽ là null ngay lập tức khi F5
  //   → ProtectedRoute redirect về /login trước khi Firebase kịp restore session
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Đăng ký listener với Firebase.
    // Callback này được gọi ngay lập tức 1 lần khi mount (Firebase đọc IndexedDB),
    // và mỗi khi trạng thái auth thay đổi (login / logout).
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // firebaseUser ở đây là object của Firebase (uid, email, displayName...),
        // chưa có thông tin của hệ thống mình (roles, display_name...).
        // Gọi /auth/sync để backend xác thực token và trả về user đầy đủ.
        try {
          const res = await api.post('/auth/sync');
          setCurrentUser(res.data);          // user data từ DB của mình
          setUserRoles(res.data.roles || []); // roles dùng để phân quyền
        } catch {
          // /auth/sync thất bại (token hết hạn, server lỗi...) → coi như chưa login
          setCurrentUser(null);
          setUserRoles([]);
        }
      } else {
        // Firebase không tìm thấy session hợp lệ (chưa login hoặc đã logout)
        setCurrentUser(null);
        setUserRoles([]);
      }

      // Dù có session hay không, loading phải được tắt để app có thể render
      setLoading(false);
    });

    // Cleanup: hủy listener khi AuthProvider unmount (tránh memory leak)
    return unsubscribe;
  }, []); // [] → chỉ chạy 1 lần khi mount, không re-run khi re-render

  async function signOut() {
    await firebaseSignOut(auth); // Firebase xóa token khỏi IndexedDB
    // setCurrentUser/setUserRoles không cần gọi ở đây vì onAuthStateChanged
    // sẽ tự được trigger với firebaseUser = null sau khi signOut
    setCurrentUser(null);
    setUserRoles([]);
  }

  // Shorthand tiện lợi, tránh phải kiểm tra userRoles.includes('ADMIN') ở mọi nơi
  const isAdmin = userRoles.includes('ADMIN');

  return (
    // Cung cấp state auth cho toàn bộ component tree bên trong
    <AuthContext.Provider value={{ currentUser, userRoles, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — dùng thay cho useContext(AuthContext) trực tiếp
// Giúp code gọn hơn: const { currentUser } = useAuth() thay vì useContext(AuthContext)
export function useAuth() {
  return useContext(AuthContext);
}

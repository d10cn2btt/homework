import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PostsPage from './pages/PostsPage';
import PostDetailPage from './pages/PostDetailPage';
import PostFormPage from './pages/PostFormPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import ErrorPage from './pages/ErrorPage';

function NavBar() {
  const { currentUser, isAdmin, signOut } = useAuth();

  if (!currentUser) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="font-semibold text-gray-800 hover:text-blue-600">
          Dashboard
        </Link>
        <Link to="/posts" className="text-gray-600 hover:text-blue-600">
          Bài viết
        </Link>
        {isAdmin && (
          <Link to="/admin/users" className="text-gray-600 hover:text-blue-600">
            Quản lý người dùng
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Link to="/profile" className="text-sm text-gray-600 hover:text-blue-600">
          {currentUser.display_name}
        </Link>
        <button
          onClick={signOut}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts"
          element={
            <ProtectedRoute>
              <PostsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts/new"
          element={
            <ProtectedRoute>
              <PostFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts/:id"
          element={
            <ProtectedRoute>
              <PostDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts/:id/edit"
          element={
            <ProtectedRoute>
              <PostFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <UserDetailPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/403" element={<ErrorPage code={403} />} />
        <Route path="/404" element={<ErrorPage code={404} />} />
        <Route path="*" element={<ErrorPage code={404} />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

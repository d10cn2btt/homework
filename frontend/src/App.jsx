import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyPosts from './pages/MyPosts';
import PostDetail from './pages/PostDetail';
import Profile from './pages/Profile';
import UserManagement from './pages/admin/UserManagement';

function PrivateRoute() {
  const { currentUser } = useAuth();
  if (currentUser === undefined) return <div className="p-8 text-center">Loading...</div>;
  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
}

function AdminRoute() {
  const { userProfile } = useAuth();
  if (!userProfile) return null;
  return userProfile.role === 'ADMIN' ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/my-posts" element={<MyPosts />} />
              <Route path="/posts/:id" element={<PostDetail />} />
              <Route path="/profile" element={<Profile />} />

              <Route element={<AdminRoute />}>
                <Route path="/admin/users" element={<UserManagement />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

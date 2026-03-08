import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { currentUser, isAdmin } = useAuth();

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">
        Xin chào, <span className="font-semibold text-gray-800">{currentUser?.display_name}</span>
        {isAdmin && (
          <span className="ml-2 inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded">
            ADMIN
          </span>
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/posts"
          className="block p-5 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Bài viết</h2>
          <p className="text-sm text-gray-500">Xem và quản lý bài viết</p>
        </Link>

        <Link
          to="/profile"
          className="block p-5 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Hồ sơ cá nhân</h2>
          <p className="text-sm text-gray-500">Cập nhật thông tin của bạn</p>
        </Link>

        {isAdmin && (
          <Link
            to="/admin/users"
            className="block p-5 bg-white border border-gray-200 rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Quản lý người dùng</h2>
            <p className="text-sm text-gray-500">Dành cho Admin</p>
          </Link>
        )}
      </div>
    </div>
  );
}

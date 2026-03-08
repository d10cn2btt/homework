import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const LIMIT = 10;

  useEffect(() => {
    if (location.state?.toast) {
      setToast(location.state.toast);
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users', { params: { page, limit: LIMIT } });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      setError('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Người dùng ({total})</h1>
        <button
          onClick={() => navigate('/admin/users/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
        >
          + Thêm người dùng
        </button>
      </div>

      {toast && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{toast}</div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vai trò</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  Chưa có người dùng nào
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${user.id}`} className="text-blue-600 hover:underline font-medium">
                    {user.display_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  {user.roles?.includes('ADMIN') ? (
                    <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded">
                      ADMIN
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded">
                      USER
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.status === 'ACTIVE' ? (
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded">
                      Hoạt động
                    </span>
                  ) : (
                    <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded">
                      Vô hiệu hóa
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            &laquo;
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}

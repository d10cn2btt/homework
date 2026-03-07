import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [role, setRole] = useState('USER');

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await api.get(`/users/${id}`);
        setUser(res.data);
        setDisplayName(res.data.display_name || '');
        setStatus(res.data.status || 'ACTIVE');
        setRole(res.data.roles?.[0] || 'USER');
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải người dùng');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (error && !user) {
    return (
      <div className="max-w-lg mx-auto mt-10 px-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
        <Link to="/admin/users" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Quay lại danh sách
        </Link>
      </div>
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api.put(`/users/${id}`, { display_name: displayName, status });
      setSuccess('Cập nhật thành công');
      const res = await api.get(`/users/${id}`);
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api.patch(`/users/${id}/role`, { role });
      setSuccess('Phân quyền thành công');
      const res = await api.get(`/users/${id}`);
      setUser(res.data);
      setRole(res.data.roles?.[0] || 'USER');
    } catch (err) {
      setError(err.response?.data?.message || 'Phân quyền thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản ${user.display_name}? Thao tác này không thể hoàn tác.`)) return;
    setSaving(true);
    try {
      await api.delete(`/users/${id}`);
      navigate('/admin/users', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Xóa thất bại');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-8 px-4">
      <Link to="/admin/users" className="text-blue-600 hover:underline text-sm">
        &larr; Quay lại danh sách
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">Chi tiết người dùng</h1>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {/* Info + Edit */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6 mb-4">
        <p className="text-sm text-gray-500 mb-1">Email</p>
        <p className="font-medium text-gray-800 mb-4">{user?.email}</p>

        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="displayName">
              Tên hiển thị
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="status">
              Trạng thái
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Vô hiệu hóa</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>

      {/* Role Assignment */}
      <div className="bg-white border border-gray-200 rounded-lg shadow p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Phân quyền vai trò</h2>
        <form onSubmit={handleRoleChange} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="role">
              Vai trò
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
          >
            Áp dụng
          </button>
        </form>
      </div>

      {/* Delete */}
      <div className="bg-white border border-red-100 rounded-lg shadow p-6">
        <h2 className="text-base font-semibold text-red-700 mb-2">Xóa tài khoản</h2>
        <p className="text-sm text-gray-500 mb-3">
          Bài viết của người dùng sẽ được giữ lại với tên tác giả là &ldquo;Người dùng đã xóa&rdquo;.
        </p>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
        >
          Xóa tài khoản
        </button>
      </div>
    </div>
  );
}

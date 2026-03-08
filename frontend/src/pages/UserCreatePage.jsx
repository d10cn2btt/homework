import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function UserCreatePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function validate() {
    if (!email.trim()) return 'Email là bắt buộc';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ';
    if (!password) return 'Mật khẩu là bắt buộc';
    if (password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post('/users', { email: email.trim(), display_name: displayName.trim() || undefined, password });
      navigate('/admin/users', { state: { toast: 'Đã tạo người dùng thành công' } });
    } catch (err) {
      if (err.response?.status === 409) {
        setError('Email này đã được sử dụng');
      } else if (err.response?.status === 400) {
        setError(err.response.data?.message || 'Dữ liệu không hợp lệ');
      } else {
        setError('Không thể tạo tài khoản. Vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-8 px-4">
      <Link to="/admin/users" className="text-blue-600 hover:underline text-sm">
        &larr; Quay lại danh sách
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">Thêm người dùng</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="displayName">
              Tên hiển thị <span className="text-gray-400 text-xs">(tùy chọn)</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              placeholder="Mặc định dùng phần trước @ của email"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Mật khẩu tạm thời <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'Đang tạo...' : 'Tạo người dùng'}
            </button>
            <Link
              to="/admin/users"
              className="flex-1 text-center border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-50 transition-colors text-sm"
            >
              Hủy
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

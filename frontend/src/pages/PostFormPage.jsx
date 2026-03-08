import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PostFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    async function fetchPost() {
      try {
        const res = await api.get(`/posts/${id}`);
        setTitle(res.data.title);
        setContent(res.data.content);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải bài viết');
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [id, isEdit]);

  if (loading) return <LoadingSpinner />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Tiêu đề không được để trống'); return; }
    if (title.length > 255) { setError('Tiêu đề tối đa 255 ký tự'); return; }
    if (!content.trim()) { setError('Nội dung không được để trống'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/posts/${id}`, { title: title.trim(), content: content.trim() });
        navigate(`/posts/${id}`, { replace: true });
      } else {
        const res = await api.post('/posts', { title: title.trim(), content: content.trim() });
        navigate(`/posts/${res.data.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lưu thất bại');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4">
      <Link to={isEdit ? `/posts/${id}` : '/posts'} className="text-blue-600 hover:underline text-sm">
        &larr; Quay lại
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">
        {isEdit ? 'Chỉnh sửa bài viết' : 'Bài viết mới'}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
            Tiêu đề <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="content">
            Nội dung <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            disabled={saving}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Đăng bài'}
        </button>
      </form>
    </div>
  );
}

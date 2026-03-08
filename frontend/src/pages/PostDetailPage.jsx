import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PostDetailPage() {
  const { id } = useParams();
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await api.get(`/posts/${id}`);
        setPost(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải bài viết');
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10 px-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
        <Link to="/posts" className="mt-4 inline-block text-blue-600 hover:underline">
          &larr; Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isAuthor = currentUser?.id === post?.author?.id;
  const canEdit = isAuthor || isAdmin;

  async function handleDelete() {
    if (!window.confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${id}`);
      navigate('/posts', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Xóa thất bại');
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4">
      <Link to="/posts" className="text-blue-600 hover:underline text-sm">
        &larr; Quay lại danh sách
      </Link>

      <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{post.title}</h1>
        <p className="text-sm text-gray-500 mb-4">
          {post.author?.display_name} &middot;{' '}
          {new Date(post.created_at).toLocaleDateString('vi-VN')}
        </p>

        <div className="prose text-gray-700 whitespace-pre-wrap mb-6">{post.content}</div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}

        {canEdit && (
          <div className="flex gap-3">
            <Link
              to={`/posts/${id}/edit`}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
            >
              Chỉnh sửa
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
            >
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

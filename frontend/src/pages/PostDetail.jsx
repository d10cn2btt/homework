import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPost } from '../api/post.api';

export default function PostDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPost(id)
      .then(({ data }) => setPost(data))
      .catch(() => setError('Post not found or access denied'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-2xl">
      <div className="mb-4">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-2xl font-semibold text-gray-800">{post.title}</h1>
        {post.status === 'draft' && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
            Draft
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-6">
        by {post.user?.displayName || post.user?.email} ·{' '}
        {new Date(post.createdAt).toLocaleDateString()}
      </p>

      <div className="text-gray-700 whitespace-pre-wrap">{post.content}</div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts } from '../api/post.api';

export default function Dashboard() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts()
      .then(({ data }) => setPosts(data.filter((p) => p.status === 'published')))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Dashboard</h1>

      {posts.length === 0 ? (
        <p className="text-gray-500">No published posts yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <Link
              key={post.id}
              to={`/posts/${post.id}`}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 transition-colors"
            >
              <h2 className="text-lg font-medium text-gray-800">{post.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                by {post.user?.displayName || post.user?.email} ·{' '}
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
              {post.content && (
                <p className="text-gray-600 mt-2 text-sm line-clamp-2">{post.content}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

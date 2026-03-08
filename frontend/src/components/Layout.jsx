import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <nav className="flex items-center gap-6">
          <Link to="/" className="font-semibold text-gray-800 hover:text-blue-600">
            Dashboard
          </Link>
          <Link to="/my-posts" className="text-gray-600 hover:text-blue-600">
            My Posts
          </Link>
          {userProfile?.role === 'ADMIN' && (
            <Link to="/admin/users" className="text-gray-600 hover:text-blue-600">
              Users
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <Link to="/profile" className="text-sm text-gray-700 hover:text-blue-600">
            {userProfile?.displayName || userProfile?.email}
            {userProfile?.role === 'ADMIN' && (
              <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                ADMIN
              </span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

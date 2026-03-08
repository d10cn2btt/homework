import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from '../api/profile.api';

export default function Profile() {
  const { userProfile, setUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await updateProfile({ displayName: displayName.trim() });
      setUserProfile((prev) => ({ ...prev, displayName: data.displayName }));
      setMessage('Profile updated successfully');
    } catch {
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Profile</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-1">Email</label>
          <p className="text-gray-800">{userProfile?.email}</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-1">Role</label>
          <span className={`text-sm px-2 py-0.5 rounded ${
            userProfile?.role === 'ADMIN'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {userProfile?.role}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 self-start"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!isAdmin) return <Navigate to="/403" replace />;

  return children;
}

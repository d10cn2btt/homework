import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const res = await api.post('/auth/sync');
          setCurrentUser(res.data);
          setUserRoles(res.data.roles || []);
        } catch {
          setCurrentUser(null);
          setUserRoles([]);
        }
      } else {
        setCurrentUser(null);
        setUserRoles([]);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signOut() {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setUserRoles([]);
  }

  const isAdmin = userRoles.includes('ADMIN');

  return (
    <AuthContext.Provider value={{ currentUser, userRoles, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

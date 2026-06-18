import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { api, ApiError, type ApiUser } from './api';

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  setUser: (u: ApiUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Stabil memoisiert (useCallback), damit Verbraucher `refresh` als Effekt-
  // Dependency nutzen können (frisches Guthaben beim Betreten/Fokussieren einer
  // Seite), ohne eine Re-Subscribe-/Render-Schleife auszulösen.
  const refresh = useCallback(async () => {
    try {
      const r = await api.me();
      setUser(r.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        // anderes Problem (Backend down etc.) — als nicht-eingeloggt behandeln
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthCtx.Provider value={{ user, loading, setUser, refresh, logout }}>{children}</AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden.');
  return ctx;
}

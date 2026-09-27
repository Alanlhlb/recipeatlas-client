import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

const tokenKey = 'recipeatlas.token';

interface AuthContextValue {
  token: string | null;
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey));
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }

    api.currentUser(token)
      .then((result) => setUser(result.data.user))
      .catch(logout)
      .finally(() => setReady(true));
  }, [token, logout]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login({ email, password });
    localStorage.setItem(tokenKey, result.data.token);
    setToken(result.data.token);
    setUser(result.data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await api.register({ name, email, password });
    await login(email, password);
  }, [login]);

  const value = useMemo(() => ({ token, user, ready, login, register, logout }), [token, user, ready, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}

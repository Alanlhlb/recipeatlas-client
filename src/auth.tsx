import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

/** `localStorage` key under which the JWT issued at login is persisted. */
const tokenKey = 'recipeatlas.token';

/**
 * Value published by {@link AuthContext} to the component tree.
 *
 * Carries the current session plus the operations that create or clear it.
 */
interface AuthContextValue {
  token: string | null;
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

/**
 * Authentication context.
 *
 * Defaults to `undefined` so {@link useAuth} can detect a missing provider.
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Supplies authentication state to the component tree.
 *
 * On mount it restores any JWT stored in `localStorage` and validates it with
 * `api.currentUser`, discarding the session when the token is rejected. The
 * resolved token, user and the login, register and logout actions are published
 * through {@link AuthContext}.
 *
 * @param props - Component props.
 * @param props.children - The application tree that may consume the session.
 */
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

/**
 * Reads the current authentication session from {@link AuthContext}.
 *
 * @returns The stored token, the resolved user, a `ready` flag indicating that
 * the session has finished restoring, and the login, register and logout actions.
 * @throws {Error} When called from a component that is not rendered inside an
 * {@link AuthProvider}.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}

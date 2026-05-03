import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getToken, removeToken, setToken } from "../api";
import type { TokenResponse, User } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (resp: TokenResponse) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    // Validate stored token with /auth/me
    fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u: User) => {
        setUser(u);
        setTokenState(stored);
      })
      .catch(() => {
        removeToken();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((resp: TokenResponse) => {
    setToken(resp.access_token);
    setTokenState(resp.access_token);
    setUser(resp.user);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

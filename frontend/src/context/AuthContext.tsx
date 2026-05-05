import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_URL, getToken, removeToken, setToken } from "../api";
import type { TokenResponse, User } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (resp: TokenResponse) => void;
  /**
   * Logout the current user.
   * For demo accounts this first calls DELETE /auth/demo-data to wipe their
   * server-side learning history so they always start fresh next login.
   * Regular users' data is never touched.
   */
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true only when the signed-in user is the demo account. */
export function isDemoUser(user: User | null): boolean {
  return user?.is_demo === true;
}

/**
 * Delete all demo user data from the server (submissions + AI-generated problems).
 * Should only be called immediately before demo user logout.
 * Silently ignores network / server errors — logout proceeds regardless.
 */
async function clearDemoUserData(token: string): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/demo-data`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Network errors are expected (e.g. server offline). Proceed with logout.
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    // Validate stored token with /auth/me
    fetch(`${API_URL}/auth/me`, {
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

  /**
   * logoutUser — always safe for regular accounts.
   *
   * Flow:
   *  1. If demo user → call DELETE /auth/demo-data (fire & await, ignore errors)
   *  2. Remove JWT from localStorage
   *  3. Clear in-memory auth state
   *
   * Regular user data is NEVER deleted. The is_demo guard on the backend
   * enforces this even if the frontend check is somehow bypassed.
   */
  const logout = useCallback(async (): Promise<void> => {
    if (isDemoUser(user)) {
      const currentToken = getToken();
      if (currentToken) {
        await clearDemoUserData(currentToken);
      }
    }
    removeToken();
    setTokenState(null);
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token: tokenState, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

import type { AppConfig } from "./types";

// Docker: VITE_API_URL=/api  → nginx proxies /api/* to backend:8000/*
// Local dev: VITE_API_URL=/api → vite proxies /api/* to localhost:8000/*
export const API_URL = import.meta.env.VITE_API_URL ?? "/api";

// ── Token storage ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem("lc_token");
}

export function setToken(token: string): void {
  localStorage.setItem("lc_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("lc_token");
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Fetch wrapper (always sends auth token if present) ────────────────────────

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

// ── App config ────────────────────────────────────────────────────────────────

export async function fetchAppConfig(): Promise<AppConfig | null> {
  try {
    const r = await fetch(`${API_URL}/config`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

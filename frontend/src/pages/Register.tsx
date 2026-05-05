import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import type { TokenResponse } from "../types";

// ── Validation helpers ────────────────────────────────────────────────────────

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "이메일을 입력해주세요.";
  const atIdx = trimmed.indexOf("@");
  const hasDot = atIdx !== -1 && trimmed.slice(atIdx).includes(".");
  if (atIdx === -1 || !hasDot || trimmed.length < 5) {
    return "올바른 이메일 형식을 입력해주세요.";
  }
  return null;
}

function validateUsername(username: string): string | null {
  if (username.length < 2) return "사용자명은 2자 이상이어야 합니다.";
  if (username.length > 80) return "사용자명은 80자 이하여야 합니다.";
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /** Client-side validation before hitting the server. Returns first error or null. */
  function validate(): string | null {
    return (
      validateEmail(email) ??
      validateUsername(username) ??
      validatePassword(password) ??
      (password !== confirmPassword ? "비밀번호가 일치하지 않습니다." : null)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const clientError = validate();
    if (clientError) {
      setError(clientError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const r = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), username, password }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        // Backend may return detail as string (409 conflict) or list (422 pydantic)
        const detail = data?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (Array.isArray(detail) && detail.length > 0) {
          setError((detail[0] as { msg?: string })?.msg ?? "입력 값을 확인해주세요.");
        } else {
          setError("회원가입에 실패했습니다. 다시 시도해주세요.");
        }
        return;
      }

      // Auto-login: backend returns JWT + user object on success
      login(data as TokenResponse);
      navigate("/", { replace: true });
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2.5 no-underline">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-xl">🐧</div>
            <div className="text-left">
              <div className="text-base font-semibold text-ink-100">Linux Coach</div>
              <div className="text-xs text-ink-600">CLI 학습 플랫폼</div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-ink-100">회원가입</h1>
            <p className="mt-0.5 text-xs text-ink-600">
              계정을 만들어 학습 기록을 영구적으로 저장하세요
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-ink-400">
                이메일
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                required
                autoFocus
                autoComplete="email"
                disabled={loading}
                placeholder="you@example.com"
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
              />
            </div>

            {/* Username */}
            <div>
              <label htmlFor="reg-username" className="mb-1.5 block text-xs font-medium text-ink-400">
                사용자명
              </label>
              <input
                id="reg-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                required
                autoComplete="username"
                disabled={loading}
                placeholder="cooluser"
                minLength={2}
                maxLength={80}
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
              />
              <p className="mt-1 text-2xs text-ink-700">2~80자</p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="mb-1.5 block text-xs font-medium text-ink-400">
                비밀번호
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                required
                autoComplete="new-password"
                disabled={loading}
                placeholder="8자 이상"
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="reg-confirm" className="mb-1.5 block text-xs font-medium text-ink-400">
                비밀번호 확인
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                required
                autoComplete="new-password"
                disabled={loading}
                placeholder="비밀번호 재입력"
                className={[
                  "w-full rounded-md border bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 transition-colors disabled:opacity-50",
                  passwordMismatch
                    ? "border-red-500/50 focus:border-red-500"
                    : "border-ink-700 focus:border-ink-500",
                ].join(" ")}
              />
              {passwordMismatch && (
                <p className="mt-1 text-2xs text-red-400">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                <span className="mt-0.5 shrink-0 text-red-400 text-xs">✕</span>
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || passwordMismatch}
              className="mt-1 w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "가입 중…" : "회원가입"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-2xs text-ink-600">
          이미 계정이 있으신가요?{" "}
          <Link to="/login" className="text-sky-400 hover:text-sky-300 transition-colors no-underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

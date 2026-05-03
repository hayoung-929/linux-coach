import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import type { TokenResponse } from "../types";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (username.trim().length < 2) return "사용자명은 2자 이상이어야 합니다.";
    if (!email.includes("@")) return "올바른 이메일 형식을 입력해주세요.";
    if (password.length < 6) return "비밀번호는 6자 이상이어야 합니다.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });

      let data: Record<string, unknown> = {};
      try {
        data = await r.json();
      } catch {
        if (r.status === 502 || r.status === 503 || r.status === 504) {
          setError("서버가 아직 준비 중입니다. 잠시 후 다시 시도해주세요.");
        } else {
          setError(`서버 오류 (${r.status}). 잠시 후 다시 시도해주세요.`);
        }
        return;
      }

      if (!r.ok) {
        const detail = data?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (Array.isArray(detail) && detail.length > 0) {
          // Pydantic validation error: [{loc, msg, type}]
          const msg = (detail[0] as Record<string, string>)?.msg ?? "입력값을 확인해주세요.";
          setError(msg);
        } else {
          setError("회원가입에 실패했습니다.");
        }
        return;
      }

      login(data as unknown as TokenResponse);
      navigate("/", { replace: true });
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

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
            <h1 className="text-base font-semibold text-ink-100">계정 만들기</h1>
            <p className="mt-0.5 text-xs text-ink-600">무료로 시작하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-400">사용자명</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                autoFocus
                autoComplete="username"
                disabled={loading}
                placeholder="gildong"
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-400">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                placeholder="you@example.com"
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-400">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                placeholder="6자 이상"
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                <span className="mt-0.5 shrink-0 text-red-400 text-xs">✕</span>
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "가입 중…" : "시작하기"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-600">
          이미 계정이 있으신가요?{" "}
          <Link to="/login" className="text-ink-300 hover:text-white transition-colors font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

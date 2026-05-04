import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_URL, fetchAppConfig } from "../api";
import { useAuth } from "../context/AuthContext";
import type { AppConfig, TokenResponse } from "../types";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, []);

  async function doLogin(em: string, pw: string) {
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = data?.detail;
        setError(typeof msg === "string" ? msg : "이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      login(data as TokenResponse);
      navigate(from, { replace: true });
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    if (cfg?.demo_email && cfg?.demo_password) {
      doLogin(cfg.demo_email, cfg.demo_password);
    } else {
      doLogin("demo@linuxcoach.local", "demo1234");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }
    if (password.length < 1) {
      setError("비밀번호를 입력해주세요.");
      return;
    }
    await doLogin(email, password);
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

        {/* Mode badge */}
        {cfg && (
          <div className="mb-3 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium ${
                cfg.ai_enabled
                  ? "border-sky-500/25 bg-sky-500/5 text-sky-400"
                  : "border-amber-500/25 bg-amber-500/5 text-amber-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.ai_enabled ? "bg-sky-500" : "bg-amber-500"}`} />
              {cfg.ai_mode}
            </span>
          </div>
        )}

        {/* Card */}
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-ink-100">로그인</h1>
            <p className="mt-0.5 text-xs text-ink-600">계정에 로그인하여 학습을 이어가세요</p>
          </div>

          {/* Demo quick start */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="mb-3 w-full rounded-md border border-sky-500/30 bg-sky-500/5 px-4 py-2.5 text-sm font-medium text-sky-300 hover:bg-sky-500/10 hover:border-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <span>⚡</span>
              데모 계정으로 빠른 시작
            </span>
          </button>
          <p className="mb-4 text-center text-2xs text-ink-600">
            처음이신가요? 회원가입 없이 즉시 체험할 수 있어요
          </p>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ink-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-ink-900 px-2 text-2xs text-ink-700">또는 직접 로그인</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-400">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
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
                autoComplete="current-password"
                disabled={loading}
                placeholder="••••••••"
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
              {loading ? "로그인 중…" : "로그인"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-2xs text-ink-700">
          현재 회원가입은 비활성화되어 있어요. 데모 계정으로 시작해보세요.
        </p>
      </div>
    </div>
  );
}

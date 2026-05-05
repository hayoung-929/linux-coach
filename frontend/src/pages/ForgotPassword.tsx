import { useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../api";
import type { ForgotPasswordResponse } from "../types";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data: ForgotPasswordResponse = await r.json().catch(() => ({
        message: "요청을 처리할 수 없습니다.",
      }));
      setResult(data);
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

        <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-ink-100">비밀번호 찾기</h1>
            <p className="mt-0.5 text-xs text-ink-600">
              가입한 이메일을 입력하면 재설정 방법을 안내해드려요
            </p>
          </div>

          {/* Dev mode notice */}
          <div className="mb-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <p className="text-2xs text-amber-300/80 leading-relaxed">
              ⚠ <strong>개발 모드:</strong> 실제 이메일 발송은 구현되지 않았습니다.
              요청 후 아래에 재설정 토큰이 표시됩니다.
            </p>
          </div>

          {result ? (
            /* ── Success state ── */
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                <span className="mt-0.5 shrink-0 text-emerald-400 text-xs">✓</span>
                <p className="text-xs text-emerald-300">{result.message}</p>
              </div>

              {result.dev_token && (
                <div className="space-y-3">
                  <div className="rounded-md border border-ink-700 bg-ink-950 p-3">
                    <p className="text-2xs font-semibold uppercase tracking-widest text-ink-600 mb-1.5">
                      개발용 재설정 토큰
                    </p>
                    <p className="font-mono text-xs text-amber-300 break-all select-all">
                      {result.dev_token}
                    </p>
                  </div>

                  <Link
                    to={result.dev_reset_url ?? `/reset-password?token=${result.dev_token}`}
                    className="block w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors text-center no-underline"
                  >
                    → 비밀번호 재설정 페이지로 이동
                  </Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setResult(null); setEmail(""); }}
                className="w-full rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-400 hover:border-ink-500 hover:text-white transition-colors"
              >
                다시 요청하기
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <div>
                <label htmlFor="fp-email" className="mb-1.5 block text-xs font-medium text-ink-400">
                  이메일
                </label>
                <input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={loading}
                  placeholder="가입 시 사용한 이메일"
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
                {loading ? "처리 중…" : "재설정 링크 요청"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-4 text-2xs text-ink-600">
          <Link to="/login" className="hover:text-ink-300 transition-colors no-underline">← 로그인</Link>
          <span className="text-ink-800">·</span>
          <Link to="/find-account" className="hover:text-ink-300 transition-colors no-underline">계정 찾기</Link>
        </div>
      </div>
    </div>
  );
}

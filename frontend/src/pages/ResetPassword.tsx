import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../api";

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (new TextEncoder().encode(pw).length > 72) return "비밀번호는 72바이트를 초과할 수 없습니다.";
  return null;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) { setError("재설정 토큰을 입력해주세요."); return; }
    const pwError = validatePassword(newPassword);
    if (pwError) { setError(pwError); return; }
    if (newPassword !== confirmPassword) { setError("비밀번호가 일치하지 않습니다."); return; }

    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          new_password: newPassword,
          confirm_new_password: confirmPassword,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = data?.detail;
        setError(typeof msg === "string" ? msg : "비밀번호 재설정에 실패했습니다.");
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 3000);
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
            <h1 className="text-base font-semibold text-ink-100">비밀번호 재설정</h1>
            <p className="mt-0.5 text-xs text-ink-600">새 비밀번호를 입력해주세요</p>
          </div>

          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
                <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                <p className="text-xs text-emerald-300 text-left">
                  비밀번호가 재설정되었습니다.
                  잠시 후 로그인 페이지로 이동합니다.
                </p>
              </div>
              <Link
                to="/login"
                className="block w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors text-center no-underline"
              >
                로그인 →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {/* Token field (editable in case URL param is missing) */}
              <div>
                <label htmlFor="rp-token" className="mb-1.5 block text-xs font-medium text-ink-400">
                  재설정 토큰
                </label>
                <input
                  id="rp-token"
                  type="text"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setError(""); }}
                  disabled={loading}
                  placeholder="이메일에서 받은 토큰"
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm font-mono text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
                />
              </div>

              {/* New password */}
              <div>
                <label htmlFor="rp-password" className="mb-1.5 block text-xs font-medium text-ink-400">
                  새 비밀번호
                </label>
                <input
                  id="rp-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  placeholder="8자 이상"
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
                />
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="rp-confirm" className="mb-1.5 block text-xs font-medium text-ink-400">
                  새 비밀번호 확인
                </label>
                <input
                  id="rp-confirm"
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
                {loading ? "재설정 중…" : "비밀번호 재설정"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-4 text-2xs text-ink-600">
          <Link to="/login" className="hover:text-ink-300 transition-colors no-underline">← 로그인</Link>
          <span className="text-ink-800">·</span>
          <Link to="/forgot-password" className="hover:text-ink-300 transition-colors no-underline">토큰 재요청</Link>
        </div>
      </div>
    </div>
  );
}

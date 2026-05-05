import { useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../api";
import type { FindAccountResponse } from "../types";

type SearchMode = "username" | "email";

export default function FindAccount() {
  const [mode, setMode] = useState<SearchMode>("username");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FindAccountResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) {
      setError(mode === "username" ? "사용자명을 입력해주세요." : "이메일을 입력해주세요.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const body = mode === "username"
        ? { username: input.trim() }
        : { email: input.trim() };
      const r = await fetch(`${API_URL}/auth/find-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: FindAccountResponse = await r.json().catch(() => ({
        message: "요청을 처리할 수 없습니다.",
      }));
      if (!r.ok) {
        const msg = (data as { detail?: string }).detail;
        setError(typeof msg === "string" ? msg : "계정을 찾을 수 없습니다.");
        return;
      }
      setResult(data);
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: SearchMode) {
    setMode(m);
    setInput("");
    setError("");
    setResult(null);
  }

  const found = result && (result.masked_email || result.username);

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
            <h1 className="text-base font-semibold text-ink-100">계정 찾기</h1>
            <p className="mt-0.5 text-xs text-ink-600">
              사용자명 또는 이메일로 계정을 찾을 수 있어요
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-md border border-ink-700 overflow-hidden mb-4">
            {(["username", "email"] as SearchMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={[
                  "flex-1 py-1.5 text-xs font-medium transition-colors",
                  mode === m
                    ? "bg-ink-800 text-ink-100"
                    : "text-ink-500 hover:text-ink-300",
                ].join(" ")}
              >
                {m === "username" ? "사용자명으로 찾기" : "이메일로 찾기"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="fa-input" className="mb-1.5 block text-xs font-medium text-ink-400">
                {mode === "username" ? "사용자명" : "이메일"}
              </label>
              <input
                id="fa-input"
                type={mode === "email" ? "email" : "text"}
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(""); setResult(null); }}
                required
                autoFocus
                disabled={loading}
                placeholder={mode === "username" ? "사용자명 입력" : "이메일 입력"}
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-700 focus:border-ink-500 transition-colors disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2.5">
                <span className="mt-0.5 shrink-0 text-red-400 text-xs">✕</span>
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`rounded-md border px-4 py-3 ${
                found
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-ink-700 bg-ink-950/40"
              }`}>
                {found ? (
                  <div className="space-y-1">
                    <p className="text-2xs font-semibold uppercase tracking-widest text-ink-600">
                      {mode === "username" ? "등록된 이메일" : "사용자명"}
                    </p>
                    <p className="text-sm font-medium text-emerald-300">
                      {mode === "username" ? result.masked_email : result.username}
                    </p>
                    {mode === "username" && (
                      <p className="text-2xs text-ink-600">개인정보 보호를 위해 일부만 표시됩니다.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-400">{result.message}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "검색 중…" : "계정 찾기"}
            </button>
          </form>
        </div>

        <div className="mt-4 flex justify-center gap-4 text-2xs text-ink-600">
          <Link to="/login" className="hover:text-ink-300 transition-colors no-underline">← 로그인</Link>
          <span className="text-ink-800">·</span>
          <Link to="/forgot-password" className="hover:text-ink-300 transition-colors no-underline">비밀번호 찾기</Link>
        </div>
      </div>
    </div>
  );
}

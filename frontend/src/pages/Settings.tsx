import { useEffect, useState } from "react";
import { fetchAppConfig } from "../api";
import {
  AIProvider,
  clearGuestSubmissions,
  clearUserAIKey,
  getUserAIKey,
  resolveCoachMode,
  setUserAIKey,
} from "../lib/guestStore";
import type { AppConfig } from "../types";

export default function Settings() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const initial = getUserAIKey();
  const [provider, setProvider] = useState<AIProvider>(initial.provider);
  const [keyVal, setKeyVal] = useState(initial.key);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setUserAIKey(provider, keyVal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearKey() {
    clearUserAIKey();
    setProvider("");
    setKeyVal("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearGuestData() {
    if (!window.confirm("Guest Mode 학습 기록을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    clearGuestSubmissions();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const mode = cfg ? resolveCoachMode(cfg.ai_enabled) : "free_rule";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-ink-500">코치 모드와 학습 기록을 관리해요.</p>
      </div>

      {/* Current mode */}
      <section className="rounded-xl border border-ink-800 bg-ink-900 p-5">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-600 mb-2">현재 코치 모드</p>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              mode === "user_ai"
                ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                : mode === "admin_ai"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mode === "user_ai" ? "bg-sky-500" : mode === "admin_ai" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {mode === "user_ai" ? "User AI Mode" : mode === "admin_ai" ? "Admin AI Mode" : "Free Rule Mode"}
          </span>
        </div>
        <p className="mt-3 text-xs text-ink-500 leading-relaxed">
          {mode === "user_ai"
            ? "현재 브라우저에 저장된 API Key로 AI 피드백을 받고 있어요."
            : mode === "admin_ai"
            ? "서버에 등록된 API Key로 AI 피드백이 동작 중이에요."
            : "현재는 내장 규칙 기반 코치가 풍부한 질문형 피드백을 제공합니다. 더 나은 피드백을 원하면 아래에서 본인의 API Key를 입력할 수 있어요."}
        </p>
      </section>

      {/* User API key */}
      <section>
        <h2 className="text-sm font-semibold text-ink-200 mb-3">개인 API Key (선택)</h2>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <p className="text-xs text-ink-500 leading-relaxed">
            본인의 OpenAI 또는 Gemini API Key를 입력하면 <span className="text-sky-400 font-medium">User AI Mode</span>로
            동작합니다. <span className="text-amber-300">Key는 현재 브라우저(localStorage)에만 저장</span>되며 서버 DB에 저장되지 않아요.
          </p>

          <form onSubmit={save} className="mt-4 space-y-3">
            <div>
              <label className="block mb-1.5 text-xs font-medium text-ink-500">제공자</label>
              <div className="flex gap-2">
                {[
                  { val: "" as AIProvider, label: "사용 안 함" },
                  { val: "openai" as AIProvider, label: "OpenAI" },
                  { val: "gemini" as AIProvider, label: "Gemini" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setProvider(opt.val)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      provider === opt.val
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        : "border-ink-700 text-ink-500 hover:border-ink-600 hover:text-ink-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {provider && (
              <div>
                <label className="block mb-1.5 text-xs font-medium text-ink-500">API Key</label>
                <div className="flex gap-2">
                  <input
                    type={showKey ? "text" : "password"}
                    value={keyVal}
                    onChange={(e) => setKeyVal(e.target.value)}
                    placeholder={provider === "openai" ? "sk-..." : "AIza..."}
                    autoComplete="off"
                    className="flex-1 rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm font-mono text-ink-100 placeholder:text-ink-700 focus:border-ink-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="rounded-md border border-ink-700 px-3 py-2 text-xs text-ink-500 hover:border-ink-500 hover:text-ink-200 transition-colors"
                  >
                    {showKey ? "숨김" : "표시"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="submit"
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors"
              >
                저장
              </button>
              <button
                type="button"
                onClick={clearKey}
                className="rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-400 hover:border-red-500/40 hover:text-red-400 transition-colors"
              >
                삭제
              </button>
              {saved && <span className="text-xs text-emerald-400 ml-2">저장됨 ✓</span>}
            </div>
          </form>

          <div className="mt-4 rounded border border-amber-500/15 bg-amber-500/5 px-3 py-2">
            <p className="text-2xs text-amber-300/80 leading-relaxed">
              ⚠ 이 Key는 현재 브라우저에만 저장됩니다. 공용/공개 PC라면 사용 후 반드시 삭제하세요.
              요청 시에는 <code className="font-mono text-amber-200">X-AI-Key</code> 헤더로 백엔드에 전달되어
              해당 요청에서만 사용된 뒤 메모리에서 사라집니다.
            </p>
          </div>
        </div>
      </section>

      {/* Guest data management */}
      <section>
        <h2 className="text-sm font-semibold text-ink-200 mb-3">Guest Mode 데이터</h2>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-300">로컬에 저장된 풀이 기록 / 정답 본 문제 목록</p>
            <p className="mt-1 text-xs text-ink-600">
              로그인하지 않은 상태에서의 모든 학습 데이터는 이 브라우저의 localStorage에만 저장돼요.
            </p>
          </div>
          <button
            type="button"
            onClick={clearGuestData}
            className="shrink-0 rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-400 hover:border-red-500/40 hover:text-red-400 transition-colors"
          >
            전체 삭제
          </button>
        </div>
      </section>
    </div>
  );
}

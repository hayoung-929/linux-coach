import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, fetchAppConfig } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import type { AppConfig, Category, Difficulty, Problem } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "idle" | "loading" | "done" | "error";

interface GenerateResult {
  problems: Problem[];
  usedFallback: boolean;
  source: string; // "ai" | "template" | "unknown"
}

// ── Error parser ──────────────────────────────────────────────────────────────

function parseApiError(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x) =>
        typeof x === "object" && x && "msg" in x
          ? String((x as { msg: string }).msg)
          : String(x)
      )
      .join(" · ");
  }
  return "알 수 없는 오류가 발생했습니다.";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GenerateProblems() {
  const [category, setCategory] = useState<Category>("file");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [count, setCount] = useState(3);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, []);

  // Clean up in-flight request on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const isFree = cfg?.mode === "free";

  async function handleGenerate() {
    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await apiFetch("/generate-problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, difficulty, count }),
        signal: ctrl.signal,
      });

      // Parse body regardless of status code so we can read error details
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      console.log("[GenerateProblems] HTTP", res.status, "response:", body);

      if (!res.ok) {
        const detail = (body as { detail?: unknown })?.detail;
        const msg = (body as { message?: unknown })?.message;
        throw new Error(parseApiError(detail ?? msg ?? `HTTP ${res.status}`));
      }

      // Validate response structure
      const data = body as { problems?: unknown };
      if (!data || typeof data !== "object") {
        throw new Error(`응답 형식 오류: 객체가 아닙니다 (${typeof data})`);
      }

      const rawProblems = data.problems;
      if (!Array.isArray(rawProblems)) {
        throw new Error(
          `응답 형식 오류: problems 필드가 배열이 아닙니다 (${typeof rawProblems})`
        );
      }

      const problems = rawProblems as Problem[];
      console.log("[GenerateProblems] parsed problems:", problems.length);

      if (problems.length === 0) {
        throw new Error(
          "서버가 빈 배열을 반환했습니다. 잠시 후 다시 시도해 주세요."
        );
      }

      // Detect fallback: all problems are template-based while AI is configured
      const allTemplate = problems.every((p) => !p.ai_generated);
      const usedFallback = Boolean(cfg?.ai_enabled && allTemplate);
      const source = problems[0]?.ai_generated
        ? "ai"
        : "template";

      setResult({ problems, usedFallback, source });
      setPhase("done");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return; // component unmounted

      const msg =
        err instanceof Error
          ? err.message
          : "네트워크 오류가 발생했습니다.";

      console.error("[GenerateProblems] error:", msg);
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  const catCfg = CATEGORY_CONFIG[category];
  const diffCfg = DIFFICULTY_CONFIG[difficulty];

  return (
    <div className="max-w-lg space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">문제 생성</h1>
        <p className="mt-0.5 text-xs text-ink-600">
          카테고리와 난이도를 지정해 새 문제를 생성합니다.
        </p>
      </div>

      {/* ── Free-mode notice ────────────────────────────────────────────── */}
      {isFree && (
        <div className="rounded-md border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-medium text-amber-300">무료 모드 (템플릿)</p>
          <p className="mt-0.5 text-xs text-amber-200/60">
            내장 문제 풀에서 선택합니다. OpenAI 또는 Gemini API 키를 설정하면
            AI가 새 문제를 직접 생성합니다.
          </p>
        </div>
      )}

      {/* ── Fallback notice ─────────────────────────────────────────────── */}
      {result?.usedFallback && (
        <div className="rounded-md border border-sky-500/15 bg-sky-500/5 px-4 py-3">
          <p className="text-xs font-medium text-sky-300">템플릿으로 대체됨</p>
          <p className="mt-0.5 text-xs text-sky-200/60">
            AI 응답에 문제가 있어 내장 템플릿으로 생성했습니다. API 키를
            확인하거나 잠시 후 다시 시도해 주세요.
          </p>
        </div>
      )}

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={phase === "loading"}
              className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-ink-500 transition-colors disabled:opacity-50"
            >
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat].label}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">난이도</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              disabled={phase === "loading"}
              className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-ink-500 transition-colors disabled:opacity-50"
            >
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_CONFIG[d].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Count */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-400">
            생성 개수{" "}
            <span className="text-ink-700">(1–10)</span>
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) =>
              setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))
            }
            disabled={phase === "loading"}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-ink-500 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={phase === "loading"}
          className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {phase === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-ink-400 border-t-ink-700 animate-spin" />
              생성 중…
            </span>
          ) : (
            "문제 생성"
          )}
        </button>
      </div>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {phase === "error" && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-red-400">생성 실패</p>
            <p className="mt-1 text-xs text-ink-500 font-mono break-all">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="rounded-md border border-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors"
          >
            ↻ 다시 시도
          </button>
        </div>
      )}

      {/* ── Success state ────────────────────────────────────────────────── */}
      {phase === "done" && result && result.problems.length > 0 && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <span>✓</span>
              {result.problems.length}개 생성 완료
              {result.source === "ai" && (
                <span className="rounded border border-sky-500/20 bg-sky-500/5 px-1.5 py-0.5 text-sky-400">
                  AI
                </span>
              )}
              {(result.source === "template" || result.usedFallback) && (
                <span className="rounded border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 text-amber-400">
                  템플릿
                </span>
              )}
            </p>
            <Link
              to="/problems"
              className="text-xs text-ink-500 hover:text-white transition-colors no-underline"
            >
              전체 목록 →
            </Link>
          </div>

          {/* Problem list */}
          <ul className="space-y-1.5">
            {result.problems.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/problems/${p.id}`}
                  className="flex items-center gap-3 rounded-md border border-ink-800 bg-ink-900 px-4 py-3 no-underline hover:border-ink-700 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-2xs rounded border px-1.5 py-0.5 font-medium ${catCfg.tw}`}>
                        {catCfg.label}
                      </span>
                      <span className={`text-2xs rounded border px-1.5 py-0.5 font-medium ${diffCfg.tw}`}>
                        {diffCfg.label}
                      </span>
                      {p.ai_generated && (
                        <span className="text-2xs rounded border border-sky-500/20 bg-sky-500/5 px-1.5 py-0.5 font-medium text-sky-400">
                          AI
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-ink-200 group-hover:text-white transition-colors truncate">
                      {p.title}
                    </p>
                    {p.concept && (
                      <p className="mt-0.5 text-2xs text-ink-600 truncate">{p.concept}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-ink-700 group-hover:text-ink-400 transition-colors text-xs">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

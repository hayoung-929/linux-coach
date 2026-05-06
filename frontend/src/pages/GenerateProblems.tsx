import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, fetchAppConfig } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import type { AppConfig, Category, Difficulty, GenerateResponse, Problem } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "idle" | "loading" | "done" | "error";

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

// ── Mode badge ────────────────────────────────────────────────────────────────

function ModeBadge({ mode, source }: { mode: string; source: string }) {
  if (source === "ai") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-2xs font-medium text-sky-400">
        ✦ AI 생성
      </span>
    );
  }
  if (mode === "free_rule") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-400">
        ⊞ 템플릿
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-400">
      ⊞ 템플릿 대체
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GenerateProblems() {
  const [category, setCategory] = useState<Category>("file");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [count, setCount] = useState(3);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  // Countdown seconds remaining after a rate-limit (429) or quota (503) error.
  const [cooldownSec, setCooldownSec] = useState(0);

  // Refs (synchronous — no re-render lag)
  const abortRef = useRef<AbortController | null>(null);
  // True while an HTTP request is in-flight. Checked synchronously at the
  // start of handleGenerate so rapid double-clicks can't fire two requests.
  const inFlightRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  // ── Cooldown timer ──────────────────────────────────────────────────────────
  function startCooldown(seconds: number) {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setCooldownSec(seconds);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSec((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current!);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Generate handler ────────────────────────────────────────────────────────
  async function handleGenerate() {
    // ── Guard 1: synchronous in-flight check (prevents double-submit even
    //            before React re-renders the disabled button)
    if (inFlightRef.current) {
      console.log("[GenerateProblems] already in flight — ignoring duplicate click");
      return;
    }
    // ── Guard 2: cooldown (rate-limit / quota backoff)
    if (cooldownSec > 0) {
      console.log(`[GenerateProblems] cooldown active (${cooldownSec}s remaining) — ignoring click`);
      return;
    }

    // Cancel any lingering previous request (e.g. from unmounted component)
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    inFlightRef.current = true;
    setPhase("loading");
    setResult(null);
    setErrorMsg("");

    console.log(
      "[GenerateProblems] POST /generate-problems",
      { category, difficulty, count },
    );

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

      console.log("[GenerateProblems] HTTP", res.status, "body:", body);

      if (!res.ok) {
        // ── 429: server-side rate limit (per-user cooldown)
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          const wait = retryAfter ? Math.max(parseInt(retryAfter, 10), 5) : 10;
          const detail = (body as { detail?: unknown })?.detail;
          const msg = typeof detail === "string" ? detail : `${wait}초 후에 다시 시도해 주세요.`;
          console.warn(`[GenerateProblems] 429 rate-limited — cooldown ${wait}s`);
          startCooldown(wait);
          throw new Error(msg);
        }
        // ── 503: AI quota exhausted (Gemini / OpenAI monthly / RPM limit)
        if (res.status === 503) {
          const detail = (body as { detail?: unknown })?.detail;
          const msg = typeof detail === "string"
            ? detail
            : "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.";
          console.warn("[GenerateProblems] 503 AI quota exhausted — cooldown 60s");
          startCooldown(60);
          throw new Error(msg);
        }

        const detail = (body as { detail?: unknown })?.detail;
        const msg = (body as { message?: unknown })?.message;
        throw new Error(parseApiError(detail ?? msg ?? `HTTP ${res.status}`));
      }

      // Validate response structure
      const data = body as GenerateResponse;
      if (!data || typeof data !== "object") {
        throw new Error(`응답 형식 오류: 객체가 아닙니다 (${typeof data})`);
      }

      const rawProblems = data.problems;
      if (!Array.isArray(rawProblems)) {
        throw new Error(
          `응답 형식 오류: problems 필드가 배열이 아닙니다 (${typeof rawProblems})`
        );
      }
      if (rawProblems.length === 0) {
        throw new Error("서버가 빈 배열을 반환했습니다. 잠시 후 다시 시도해 주세요.");
      }

      console.log(
        "[GenerateProblems] success count=%d mode=%s source=%s ids=%s",
        rawProblems.length,
        data.mode,
        data.source,
        rawProblems.map((p) => p.id).join(","),
      );

      setResult(data);
      setPhase("done");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Component unmounted or explicit abort — silently exit
        return;
      }

      const msg =
        err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";

      console.error("[GenerateProblems] error:", msg);
      setErrorMsg(msg);
      setPhase("error");
    } finally {
      inFlightRef.current = false;
    }
  }

  const isFree = cfg?.mode === "free";
  const catCfg = CATEGORY_CONFIG[category];
  const diffCfg = DIFFICULTY_CONFIG[difficulty];
  const firstProblem: Problem | undefined = result?.problems[0];

  // The button is blocked during loading OR during cooldown
  const isBlocked = phase === "loading" || cooldownSec > 0;

  function buttonLabel() {
    if (phase === "loading") {
      return (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-ink-400 border-t-ink-700 animate-spin" />
          생성 중…
        </span>
      );
    }
    if (cooldownSec > 0) {
      return `${cooldownSec}초 후 재시도 가능`;
    }
    return "문제 생성";
  }

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
      {isFree && phase !== "done" && (
        <div className="rounded-md border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-medium text-amber-300">무료 모드 (템플릿)</p>
          <p className="mt-0.5 text-xs text-amber-200/60">
            내장 문제 풀에서 랜덤 변수를 적용해 생성합니다. OpenAI 또는 Gemini API
            키를 설정하면 AI가 새 문제를 직접 생성합니다.
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
              disabled={isBlocked}
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
              disabled={isBlocked}
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
            disabled={isBlocked}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-ink-500 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isBlocked}
          className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {buttonLabel()}
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
            disabled={isBlocked}
            className="rounded-md border border-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cooldownSec > 0 ? `↻ ${cooldownSec}초 후 재시도` : "↻ 다시 시도"}
          </button>
        </div>
      )}

      {/* ── Success state ────────────────────────────────────────────────── */}
      {phase === "done" && result && result.problems.length > 0 && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <span>✓</span>
                {result.count}개 생성 완료
              </p>
              <ModeBadge mode={result.mode} source={result.source} />
            </div>
            <Link
              to="/problems"
              className="text-xs text-ink-500 hover:text-white transition-colors no-underline"
            >
              전체 목록 →
            </Link>
          </div>

          {/* Server message */}
          {result.message && (
            <p className="text-xs text-ink-500">{result.message}</p>
          )}

          {/* Fallback notice — shown when AI was configured but template was used */}
          {result.source === "template" && result.mode !== "free_rule" && (
            <div className="rounded-md border border-sky-500/15 bg-sky-500/5 px-4 py-3">
              <p className="text-xs font-medium text-sky-300">템플릿으로 대체됨</p>
              <p className="mt-0.5 text-xs text-sky-200/60">
                AI 응답에 문제가 있어 내장 템플릿으로 생성했습니다. API 키를
                확인하거나 잠시 후 다시 시도해 주세요.
              </p>
            </div>
          )}

          {/* Quick-start CTA */}
          {firstProblem && (
            <Link
              to={`/problems/${firstProblem.id}`}
              className="flex items-center justify-center gap-2 rounded-md bg-white py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors no-underline"
            >
              첫 번째 문제 풀기 →
            </Link>
          )}

          {/* Problem list */}
          <ul className="space-y-1.5">
            {result.problems.map((p, idx) => (
              <li key={p.id}>
                <Link
                  to={`/problems/${p.id}`}
                  className="flex items-center gap-3 rounded-md border border-ink-800 bg-ink-900 px-4 py-3 no-underline hover:border-ink-700 transition-colors group"
                >
                  <span className="shrink-0 text-xs text-ink-700 w-4 text-right">
                    {idx + 1}
                  </span>
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

          {/* Generate more — disabled during loading or cooldown */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isBlocked}
            className="w-full rounded-md border border-ink-700 py-2 text-xs text-ink-400 hover:border-ink-500 hover:text-ink-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cooldownSec > 0
              ? `↻ ${cooldownSec}초 후 재생성 가능`
              : "↻ 같은 조건으로 다시 생성"}
          </button>
        </div>
      )}
    </div>
  );
}

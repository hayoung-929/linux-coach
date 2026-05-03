import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_URL, apiFetch, fetchAppConfig } from "../api";
import { CATEGORY_CONFIG, DIFFICULTY_CONFIG } from "../constants";
import { useAuth } from "../context/AuthContext";
import type { AppConfig, Problem, SubmitResult } from "../types";

export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showConcept, setShowConcept] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, []);

  useEffect(() => {
    setShowHint(false);
    setShowConcept(false);
    setUserAnswer("");
    setResult(null);
    setLoading(true);
    setNotFound(false);
    fetch(`${API_URL}/problems/${id}`)
      .then((r) => {
        if (r.status === 404) throw Object.assign(new Error(), { is404: true });
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: Problem) => {
        setProblem(d);
        setLoading(false);
      })
      .catch((e: Error & { is404?: boolean }) => {
        setNotFound(!!e.is404);
        setLoading(false);
      });
  }, [id]);

  function handleSubmit() {
    if (!userAnswer.trim() || submitting) return;
    if (!user) {
      navigate("/login");
      return;
    }
    setSubmitting(true);
    apiFetch(`/problems/${id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_answer: userAnswer }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: SubmitResult) => setResult(d))
      .catch(() => setResult({ is_correct: false, message: "제출 중 오류가 발생했습니다." }))
      .finally(() => setSubmitting(false));
  }

  function handleReset() {
    setUserAnswer("");
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-ink-800" />
        <div className="h-7 w-3/4 rounded bg-ink-800" />
        <div className="h-24 rounded-lg bg-ink-900" />
        <div className="h-32 rounded-lg bg-ink-900" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-ink-500 mb-4">문제를 찾을 수 없습니다.</p>
        <Link to="/problems" className="text-xs text-ink-400 hover:text-white transition-colors">
          ← 목록으로 돌아가기
        </Link>
      </div>
    );
  }
  if (!problem) return null;

  const cat = CATEGORY_CONFIG[problem.category] ?? { label: problem.category, tw: "text-ink-400 border-ink-700" };
  const diff = DIFFICULTY_CONFIG[problem.difficulty] ?? DIFFICULTY_CONFIG.easy;
  const coachLabel = cfg?.mode === "ai" ? "AI 코치" : "코치";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-ink-600">
        <Link to="/problems" className="hover:text-ink-300 transition-colors">문제 목록</Link>
        <span>/</span>
        <span className="text-ink-400">#{problem.id}</span>
      </div>

      {/* Title & badges */}
      <div>
        <h1 className="text-lg font-semibold text-white leading-snug">{problem.title}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cat.tw}`}>
            {cat.label}
          </span>
          <span className={`rounded border px-2 py-0.5 text-xs font-medium ${diff.tw}`}>{diff.label}</span>
          {problem.ai_generated && (
            <span className="rounded border border-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-400">AI 생성</span>
          )}
        </div>
      </div>

      {/* Concept (collapsible) */}
      <button
        type="button"
        onClick={() => setShowConcept((v) => !v)}
        className="w-full flex items-center justify-between rounded-md border border-ink-800 bg-ink-900 px-4 py-3 text-left group"
      >
        <span className="text-xs font-medium text-ink-500">개념 설명</span>
        <span className="text-ink-700 group-hover:text-ink-400 transition-colors text-xs">{showConcept ? "▲" : "▼"}</span>
      </button>
      {showConcept && (
        <div className="rounded-md border border-ink-800 bg-ink-900/60 px-4 py-3 -mt-3 text-sm text-ink-400 leading-relaxed">
          {problem.concept}
        </div>
      )}

      {/* Question */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ink-600">문제</p>
        <div className="rounded-lg border border-ink-800 bg-ink-950 px-4 py-4 text-sm text-ink-300 leading-relaxed whitespace-pre-wrap font-sans">
          {problem.question}
        </div>
      </section>

      {/* Hint */}
      <div>
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          className="text-xs text-ink-600 hover:text-ink-400 transition-colors border border-ink-800 rounded px-2.5 py-1"
        >
          {showHint ? "힌트 숨기기" : "힌트 보기"}
        </button>
        {showHint && (
          <div className="mt-2 rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/80 leading-relaxed">
            <span className="text-amber-500 mr-2 text-xs font-semibold uppercase tracking-wider">힌트</span>
            {problem.hint}
          </div>
        )}
      </div>

      {/* Answer input */}
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ink-600">명령어 입력</p>
        <div className="rounded-lg border border-ink-800 bg-ink-950 overflow-hidden">
          {/* Terminal header */}
          <div className="flex items-center gap-1.5 border-b border-ink-800 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-red-500/50" />
            <span className="h-2 w-2 rounded-full bg-amber-500/50" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
            <span className="ml-2 text-2xs text-ink-700 font-mono">bash</span>
          </div>
          {/* Input line */}
          <div className="flex items-center px-4 py-3 gap-2">
            <span className="shrink-0 font-mono text-sm text-emerald-400 select-none">$</span>
            <input
              ref={inputRef}
              type="text"
              value={userAnswer}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                setResult(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={user ? "명령어를 입력하고 Enter" : "로그인 후 제출 가능합니다"}
              disabled={submitting}
              className="flex-1 bg-transparent border-0 font-mono text-sm text-ink-100 outline-none placeholder:text-ink-700 disabled:opacity-60"
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
            {userAnswer.trim() && !submitting && (
              <button
                type="button"
                onClick={() => setUserAnswer("")}
                className="text-ink-700 hover:text-ink-400 text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-2">
          {user ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!userAnswer.trim() || submitting}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "채점 중…" : "제출"}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors no-underline"
            >
              로그인하여 제출
            </Link>
          )}
          {result && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-400 hover:border-ink-500 hover:text-white transition-colors"
            >
              다시 시도
            </button>
          )}
        </div>
      </section>

      {/* Result */}
      {result && (
        <section className="space-y-3">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
              result.is_correct
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-red-500/20 bg-red-500/5"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                result.is_correct
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {result.is_correct ? "✓" : "✗"}
            </span>
            <div>
              <p className={`text-sm font-medium ${result.is_correct ? "text-emerald-300" : "text-red-300"}`}>
                {result.is_correct ? "정답입니다!" : "오답입니다"}
              </p>
              {!result.is_correct && (
                <p className="text-xs text-ink-500 mt-0.5">힌트를 참고하거나 다시 시도해보세요.</p>
              )}
            </div>
          </div>

          {/* AI Feedback */}
          {!result.is_correct && result.feedback && (
            <div className="rounded-lg border border-ink-800 bg-ink-900 px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">{coachLabel}</span>
                <span className="h-px flex-1 bg-ink-800" />
              </div>
              <p className="text-sm text-ink-300 leading-relaxed whitespace-pre-wrap">{result.feedback}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

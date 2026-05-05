import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import { useAuth } from "../context/AuthContext";
import { computeGuestStats, GuestStats } from "../lib/guestStore";
import type { Category, Difficulty, Problem, StatsData, WrongNote } from "../types";

type Breakdown = { total: number; wrong: number };

export default function Stats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [wrongNotes, setWrongNotes] = useState<WrongNote[]>([]);
  const [guestStats, setGuestStats] = useState<GuestStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always load problems list (public)
    apiFetch("/problems")
      .then((r) => r.json())
      .then((p: Problem[]) => setProblems(p))
      .catch(() => {});

    if (user) {
      Promise.all([
        apiFetch("/stats").then((r) => {
          if (!r.ok) return null;
          return r.json();
        }),
        apiFetch("/wrong-notes").then((r) => {
          if (!r.ok) return [];
          return r.json();
        }),
      ])
        .then(([s, w]) => {
          if (s) setStats(s);
          setWrongNotes(w ?? []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      // Guest mode — compute from localStorage
      const gs = computeGuestStats();
      setGuestStats(gs);
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-32 rounded bg-ink-800" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-lg bg-ink-900" />)}
        </div>
      </div>
    );
  }

  // ── Guest stats view ───────────────────────────────────────────────────────
  if (!user && guestStats) {
    const gs = guestStats;

    // Category breakdown from guest submissions
    const guestCatWrong: Partial<Record<string, number>> = {};
    gs.weak_categories.forEach((c) => { guestCatWrong[c.category] = c.wrong; });

    const GUEST_TOP = [
      { label: "오늘 풀이", value: gs.today_solved, color: gs.today_solved > 0 ? "text-emerald-400" : "text-white" },
      { label: "연속 일수", value: `${gs.streak_days}일`, color: gs.streak_days > 0 ? "text-sky-400" : "text-white" },
      { label: "총 제출", value: gs.total_submissions, color: "text-white" },
      { label: "정답", value: gs.correct_count, color: "text-emerald-400" },
      { label: "오답", value: gs.wrong_count, color: "text-red-400" },
      { label: "정답률", value: `${gs.accuracy}%`, color: "text-amber-400" },
    ];

    return (
      <div className="space-y-7 max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">통계</h1>
            <p className="mt-0.5 text-xs text-ink-600">
              Guest Mode · 이 브라우저에 저장됨
            </p>
          </div>
          <Link
            to="/login"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-400 hover:border-ink-500 hover:text-white transition-colors no-underline"
          >
            로그인하면 서버에 저장 →
          </Link>
        </div>

        {gs.total_submissions === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-ink-800 bg-ink-900/50 py-20 text-center">
            <p className="text-2xl mb-2 text-ink-700">◫</p>
            <p className="text-sm font-medium text-ink-400">아직 풀이 기록이 없어요</p>
            <p className="mt-1 text-xs text-ink-600">문제를 풀면 여기에 통계가 표시돼요</p>
            <Link
              to="/problems"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-xs font-medium text-ink-950 hover:bg-ink-100 transition-colors no-underline"
            >
              문제 풀러 가기 →
            </Link>
          </div>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-3 gap-2">
              {GUEST_TOP.map((c) => (
                <div key={c.label} className="rounded-lg border border-ink-800 bg-ink-900 p-3">
                  <p className={`text-xl font-semibold tabular-nums ${c.color}`}>{c.value}</p>
                  <p className="mt-0.5 text-xs text-ink-600">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Accuracy bar */}
            {gs.total_submissions > 0 && (
              <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-ink-500">정답률</p>
                  <p className="text-sm font-semibold text-amber-400">{gs.accuracy}%</p>
                </div>
                <div className="h-1.5 rounded-full bg-ink-950 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${gs.accuracy}%` }}
                  />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-ink-600">
                  <span className="text-emerald-400">정답 {gs.correct_count}</span>
                  <span className="text-red-400">오답 {gs.wrong_count}</span>
                  <span>정답 본 문제 {gs.viewed_answer_count}</span>
                </div>
              </div>
            )}

            {/* Weak categories */}
            {gs.weak_categories.length > 0 && (
              <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-ink-600 mb-3">약점 카테고리</p>
                <ul className="space-y-3">
                  {gs.weak_categories.map((c) => {
                    const cfg = CATEGORY_CONFIG[c.category as keyof typeof CATEGORY_CONFIG];
                    const pct = Math.round(c.wrong_rate * 100);
                    return (
                      <li key={c.category} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${cfg?.tw.split(" ")[0] ?? "text-ink-400"}`}>
                            {cfg?.label ?? c.category}
                          </span>
                          <span className="text-2xs tabular-nums text-ink-500">
                            {c.wrong}/{c.total} ({pct}% 오답)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-ink-950 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  to="/quiz"
                  className="mt-4 inline-flex text-xs text-sky-500 hover:text-sky-400 transition-colors no-underline"
                >
                  퀴즈로 보완하기 →
                </Link>
              </div>
            )}

            {/* Recent wrong */}
            {gs.recent_wrong.length > 0 && (
              <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
                <p className="text-xs font-medium uppercase tracking-widest text-ink-600 mb-3">최근 오답</p>
                <ul className="space-y-2">
                  {gs.recent_wrong.map((w, i) => {
                    const cfg = CATEGORY_CONFIG[w.category as keyof typeof CATEGORY_CONFIG];
                    return (
                      <li key={i}>
                        <Link
                          to={`/problems/${w.problem_id}`}
                          className="flex items-center gap-3 rounded-md hover:bg-ink-800/40 px-2 py-2 transition-colors no-underline"
                        >
                          <span className={`shrink-0 inline-flex rounded border px-1.5 py-0.5 text-2xs font-medium ${cfg?.tw ?? "text-ink-400 border-ink-700"}`}>
                            {cfg?.label ?? w.category}
                          </span>
                          <span className="flex-1 text-xs text-ink-300 truncate">{w.problem_title}</span>
                          <span className="shrink-0 font-mono text-2xs text-red-400 truncate max-w-[120px]">{w.user_answer}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Logged-in stats view ───────────────────────────────────────────────────
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-ink-500">통계를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const byCategory: Partial<Record<Category, Breakdown>> = {};
  for (const p of problems) {
    if (!byCategory[p.category]) byCategory[p.category] = { total: 0, wrong: 0 };
    byCategory[p.category]!.total++;
  }
  for (const w of wrongNotes) {
    if (!byCategory[w.category]) byCategory[w.category] = { total: 0, wrong: 0 };
    byCategory[w.category]!.wrong++;
  }

  const byDifficulty: Partial<Record<Difficulty, Breakdown>> = {};
  for (const p of problems) {
    if (!byDifficulty[p.difficulty]) byDifficulty[p.difficulty] = { total: 0, wrong: 0 };
    byDifficulty[p.difficulty]!.total++;
  }

  const TOP_STATS = [
    { label: "전체 문제", value: stats.total_problems, color: "text-white" },
    { label: "AI 생성", value: stats.ai_problems, color: "text-sky-400" },
    { label: "총 제출", value: stats.total_submissions, color: "text-white" },
    { label: "정답", value: stats.correct_submissions, color: "text-emerald-400" },
    { label: "오답", value: stats.wrong_submissions, color: "text-red-400" },
    { label: "정답률", value: `${stats.accuracy}%`, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-7 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">통계</h1>
        <p className="mt-0.5 text-xs text-ink-600">내 학습 현황 분석</p>
      </div>

      {/* Top stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {TOP_STATS.map((c) => (
          <div key={c.label} className="rounded-lg border border-ink-800 bg-ink-900 p-3">
            <p className={`text-xl font-semibold tabular-nums ${c.color}`}>{c.value}</p>
            <p className="mt-0.5 text-xs text-ink-600">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Accuracy bar */}
      {stats.total_submissions > 0 && (
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-ink-500">정답률</p>
            <p className="text-sm font-semibold text-amber-400">{stats.accuracy}%</p>
          </div>
          <div className="h-1.5 rounded-full bg-ink-950 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${stats.accuracy}%` }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-ink-600">
            <span className="text-emerald-400">정답 {stats.correct_submissions}</span>
            <span className="text-red-400">오답 {stats.wrong_submissions}</span>
          </div>
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-600 mb-3">카테고리별</p>
          <ul className="space-y-2.5">
            {CATEGORY_ORDER.map((cat) => {
              const data = byCategory[cat];
              const cfg = CATEGORY_CONFIG[cat];
              const n = data?.total ?? 0;
              const pct = problems.length ? Math.round((n / problems.length) * 100) : 0;
              return (
                <li key={cat} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${cfg.tw.split(" ")[0]}`}>{cfg.label}</span>
                    <span className="text-xs tabular-nums text-ink-600">{n}</span>
                  </div>
                  <div className="h-1 rounded-full bg-ink-950 overflow-hidden">
                    <div className="h-full rounded-full bg-sky-500/60" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-600 mb-3">난이도별</p>
          <ul className="space-y-2.5">
            {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((diff) => {
              const data = byDifficulty[diff];
              const cfg = DIFFICULTY_CONFIG[diff];
              const n = data?.total ?? 0;
              const pct = problems.length ? Math.round((n / problems.length) * 100) : 0;
              return (
                <li key={diff} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${cfg.tw.split(" ")[0]}`}>{cfg.label}</span>
                    <span className="text-xs tabular-nums text-ink-600">{n}</span>
                  </div>
                  <div className="h-1 rounded-full bg-ink-950 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        diff === "easy" ? "bg-emerald-500/60" : diff === "medium" ? "bg-amber-500/60" : "bg-red-500/60"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Wrong note summary */}
          {wrongNotes.length > 0 && (
            <div className="mt-5 pt-4 border-t border-ink-800">
              <p className="text-xs font-medium uppercase tracking-widest text-ink-600 mb-2">오답 기록</p>
              <p className="text-2xl font-semibold text-red-400">{wrongNotes.length}</p>
              <p className="text-xs text-ink-600 mt-0.5">개 오답 기록</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

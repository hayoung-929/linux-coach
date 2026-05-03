import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import type { Category, Difficulty, Problem, StatsData, WrongNote } from "../types";

type Breakdown = { total: number; wrong: number };

export default function Stats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [wrongNotes, setWrongNotes] = useState<WrongNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/stats").then((r) => {
        if (r.status === 401) { navigate("/login"); return null; }
        return r.json();
      }),
      apiFetch("/problems").then((r) => r.json()),
      apiFetch("/wrong-notes").then((r) => {
        if (r.status === 401) return [];
        return r.json();
      }),
    ])
      .then(([s, p, w]) => {
        if (!s) return;
        setStats(s);
        setProblems(p);
        setWrongNotes(w);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

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

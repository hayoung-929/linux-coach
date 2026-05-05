import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import { useAuth } from "../context/AuthContext";
import { computeGuestStats, getViewedAnswers } from "../lib/guestStore";
import type { AnalysisData, Category, Problem } from "../types";

type CatFilter = "all" | Category;
type TypeFilter = "all" | "command" | "quiz";
type StatusFilter = "all" | "solved" | "unsolved" | "wrong" | "viewed";

const DIFF_BAR: Record<string, string> = {
  beginner: "w-1/5 bg-sky-500",
  easy: "w-1/3 bg-emerald-500",
  medium: "w-2/3 bg-amber-500",
  hard: "w-full bg-red-500",
};

export default function ProblemList() {
  const { user } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [guestSolved, setGuestSolved] = useState<Set<number>>(new Set());
  const [guestWrong, setGuestWrong] = useState<Set<number>>(new Set());
  const [viewed, setViewed] = useState<Set<number>>(new Set());

  useEffect(() => {
    apiFetch("/problems")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: Problem[]) => {
        setProblems(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });

    if (user) {
      apiFetch("/analysis")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: AnalysisData) => setAnalysis(d))
        .catch(() => {});
    }

    // Always read guest store too — it's just localStorage
    const stats = computeGuestStats();
    setGuestSolved(new Set(stats.solved_problem_ids));
    const wrongIds = new Set<number>();
    stats.recent_wrong.forEach((s) => wrongIds.add(s.problem_id));
    setGuestWrong(wrongIds);
    setViewed(getViewedAnswers());
  }, [user]);

  const solvedSet = useMemo(() => {
    const s = new Set<number>(guestSolved);
    analysis?.solved_problem_ids?.forEach((id) => s.add(id));
    return s;
  }, [guestSolved, analysis]);

  const weakCategories = useMemo(() => {
    const set = new Set<string>();
    analysis?.weak_categories?.forEach((c) => set.add(c.category));
    return set;
  }, [analysis]);

  const filtered = problems.filter((p) => {
    if (catFilter !== "all" && p.category !== catFilter) return false;
    if (typeFilter !== "all" && p.problem_type !== typeFilter) return false;
    if (statusFilter === "solved" && !solvedSet.has(p.id)) return false;
    if (statusFilter === "unsolved" && solvedSet.has(p.id)) return false;
    if (statusFilter === "wrong" && !guestWrong.has(p.id)) return false;
    if (statusFilter === "viewed" && !viewed.has(p.id)) return false;
    return true;
  });

  const counts = problems.reduce<Partial<Record<Category, number>>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">문제 목록</h1>
          <p className="mt-0.5 text-xs text-ink-600">
            {loading
              ? "불러오는 중…"
              : `${filtered.length}개 표시 중 · 전체 ${problems.length} · 풀이 완료 ${solvedSet.size}`}
          </p>
        </div>
        {user && (
          <Link
            to="/generate"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-ink-500 hover:text-white transition-colors no-underline"
          >
            <span>+</span> 생성
          </Link>
        )}
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5">
        {(["all", "command", "quiz"] as TypeFilter[]).map((t) => (
          <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
            {t === "all" ? "전체 유형" : t === "command" ? "명령어" : "퀴즈"}
          </FilterChip>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { v: "all", l: "전체 상태" },
            { v: "unsolved", l: "미해결" },
            { v: "solved", l: "해결됨" },
            { v: "wrong", l: "오답만" },
            { v: "viewed", l: "정답 본 문제" },
          ] as { v: StatusFilter; l: string }[]
        ).map((s) => (
          <FilterChip key={s.v} active={statusFilter === s.v} onClick={() => setStatusFilter(s.v)}>
            {s.l}
          </FilterChip>
        ))}
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={catFilter === "all"} onClick={() => setCatFilter("all")}>
          전체 <span className="text-ink-600 ml-1">{problems.length}</span>
        </FilterChip>
        {CATEGORY_ORDER.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <FilterChip
              key={cat}
              active={catFilter === cat}
              onClick={() => setCatFilter(cat)}
              accent={weakCategories.has(cat) ? "weak" : undefined}
            >
              {cfg.label}
              {counts[cat] != null && (
                <span className={`ml-1 ${catFilter === cat ? "text-ink-500" : "text-ink-700"}`}>{counts[cat]}</span>
              )}
            </FilterChip>
          );
        })}
      </div>

      {/* States */}
      {loading && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-ink-800 bg-ink-900 animate-pulse" />
          ))}
        </div>
      )}
      {error && (
        <EmptyState icon="⚠" title="연결 실패" desc="백엔드 서버에 연결할 수 없습니다." />
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState icon="○" title="문제 없음" desc="조건에 맞는 문제가 없습니다." />
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const cat = CATEGORY_CONFIG[p.category] ?? { label: p.category, icon: "?", tw: "text-ink-400 border-ink-700" };
            const diff = DIFFICULTY_CONFIG[p.difficulty] ?? DIFFICULTY_CONFIG.easy;
            const isQuiz = p.problem_type === "quiz";
            const isSolved = solvedSet.has(p.id);
            const isWeak = weakCategories.has(p.category);
            const isViewed = viewed.has(p.id);
            return (
              <Link
                key={p.id}
                to={`/problems/${p.id}`}
                className={[
                  "group flex flex-col rounded-lg border bg-ink-900 overflow-hidden no-underline transition-colors",
                  isSolved ? "border-emerald-500/15 hover:border-emerald-500/40" : "border-ink-800 hover:border-ink-700",
                ].join(" ")}
              >
                <div className="flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-medium ${cat.tw}`}>
                      {cat.label}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-2xs font-medium ${diff.tw}`}>
                      {diff.label}
                    </span>
                    {isQuiz && (
                      <span className="text-2xs text-violet-400 border border-violet-500/20 rounded px-1.5 py-0.5">
                        퀴즈
                      </span>
                    )}
                    {isWeak && (
                      <span className="text-2xs text-red-400 border border-red-500/20 rounded px-1.5 py-0.5" title="자주 틀리는 카테고리">
                        약점
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      {isViewed && (
                        <span className="text-2xs text-ink-600 border border-ink-700 rounded px-1.5 py-0.5" title="정답을 본 문제">
                          답봄
                        </span>
                      )}
                      {isSolved && (
                        <span className="text-2xs text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">
                          ✓ 해결
                        </span>
                      )}
                      {p.ai_generated && (
                        <span className="text-2xs text-sky-500 border border-sky-500/20 rounded px-1.5 py-0.5">AI</span>
                      )}
                    </div>
                  </div>
                  <h2 className="text-sm font-medium text-ink-200 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                    {p.title}
                  </h2>
                  {p.concept && (
                    <p className="mt-1.5 text-2xs text-ink-600 line-clamp-1">{p.concept}</p>
                  )}
                </div>
                <div className="h-0.5 bg-ink-950">
                  <div className={`h-full ${DIFF_BAR[p.difficulty] ?? DIFF_BAR.easy}`} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: "weak";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-ink-500 bg-ink-800 text-ink-100"
          : accent === "weak"
          ? "border-red-500/20 text-red-300/90 hover:border-red-500/40"
          : "border-ink-800 text-ink-500 hover:border-ink-700 hover:text-ink-300",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-ink-800 bg-ink-900/50 py-16 text-center">
      <span className="text-2xl text-ink-700 mb-2">{icon}</span>
      <p className="text-sm font-medium text-ink-400">{title}</p>
      <p className="mt-1 text-xs text-ink-600">{desc}</p>
    </div>
  );
}

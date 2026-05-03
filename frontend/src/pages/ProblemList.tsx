import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import type { Category, Problem } from "../types";

type CatFilter = "all" | Category;
type TypeFilter = "all" | "command" | "quiz";

const DIFF_BAR: Record<string, string> = {
  beginner: "w-1/5 bg-sky-500",
  easy: "w-1/3 bg-emerald-500",
  medium: "w-2/3 bg-amber-500",
  hard: "w-full bg-red-500",
};

export default function ProblemList() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

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
  }, []);

  const filtered = problems.filter((p) => {
    if (catFilter !== "all" && p.category !== catFilter) return false;
    if (typeFilter !== "all" && p.problem_type !== typeFilter) return false;
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
            {loading ? "불러오는 중…" : `${filtered.length}개 표시 중 (전체 ${problems.length}개)`}
          </p>
        </div>
        <Link
          to="/generate"
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-ink-500 hover:text-white transition-colors no-underline"
        >
          <span>+</span> 생성
        </Link>
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5">
        {(["all", "command", "quiz"] as TypeFilter[]).map((t) => (
          <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
            {t === "all" ? "전체 유형" : t === "command" ? "명령어" : "퀴즈"}
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
            <FilterChip key={cat} active={catFilter === cat} onClick={() => setCatFilter(cat)}>
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
        <EmptyState icon="○" title="문제 없음" desc="해당 카테고리의 문제가 없습니다." />
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const cat = CATEGORY_CONFIG[p.category] ?? { label: p.category, icon: "?", tw: "text-ink-400 border-ink-700" };
            const diff = DIFFICULTY_CONFIG[p.difficulty] ?? DIFFICULTY_CONFIG.easy;
            const isQuiz = p.problem_type === "quiz";
            return (
              <Link
                key={p.id}
                to={`/problems/${p.id}`}
                className="group flex flex-col rounded-lg border border-ink-800 bg-ink-900 overflow-hidden no-underline hover:border-ink-700 transition-colors"
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
                    {p.ai_generated && (
                      <span className="ml-auto text-2xs text-sky-500 border border-sky-500/20 rounded px-1.5 py-0.5">
                        AI
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-medium text-ink-200 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                    {p.title}
                  </h2>
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-ink-500 bg-ink-800 text-ink-100"
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

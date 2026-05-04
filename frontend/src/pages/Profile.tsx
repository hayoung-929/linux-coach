import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { CATEGORY_CONFIG } from "../constants";
import { useAuth } from "../context/AuthContext";
import type { Category, ProfileData } from "../types";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch("/profile")
      .then((r) => {
        if (r.status === 401) {
          navigate("/login");
          return Promise.reject();
        }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: ProfileData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="h-32 rounded-lg border border-ink-800 bg-ink-900 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-ink-800 bg-ink-900 animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-lg border border-ink-800 bg-ink-900 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <p className="text-sm text-ink-400">프로필을 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { user: u, stats, weak_categories, weak_concepts, recent_wrong_notes, ai_mode, ai_enabled } = data;
  const joinedDate = new Date(u.created_at).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* User card */}
      <section className="rounded-xl border border-ink-800 bg-ink-900 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-base font-bold text-sky-400 ring-1 ring-sky-500/30">
            {u.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white tracking-tight truncate">{u.username}</h1>
            <p className="text-sm text-ink-500 truncate">{u.email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-2xs text-ink-600">가입일</span>
              <span className="text-2xs font-medium text-ink-400">{joinedDate}</span>
              <span className="mx-1 text-ink-800">·</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium ${
                  ai_enabled
                    ? "border-sky-500/25 bg-sky-500/5 text-sky-400"
                    : "border-amber-500/25 bg-amber-500/5 text-amber-400"
                }`}
              >
                <span className={`h-1 w-1 rounded-full ${ai_enabled ? "bg-sky-500" : "bg-amber-500"}`} />
                {ai_mode}
              </span>
            </div>
            {!ai_enabled && (
              <p className="mt-2 text-2xs text-ink-600 leading-relaxed">
                무료 모드에서는 내장 규칙 기반 코치가 질문형 피드백을 제공합니다.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section>
        <p className="mb-3 text-2xs font-semibold uppercase tracking-widest text-ink-600">학습 통계</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "총 풀이", value: stats.total_submissions, color: "text-white" },
            { label: "정답", value: stats.correct_count, color: "text-emerald-400" },
            { label: "오답", value: stats.wrong_count, color: "text-red-400" },
            { label: "정답률", value: `${stats.accuracy}%`, color: "text-sky-400" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-ink-800 bg-ink-900 p-3">
              <p className={`text-xl font-semibold tabular-nums ${c.color}`}>{c.value}</p>
              <p className="mt-0.5 text-2xs text-ink-600">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg border border-ink-800 bg-ink-900 p-3 flex items-center justify-between">
          <span className="text-xs text-ink-500">내가 생성한 문제</span>
          <span className="text-sm font-semibold tabular-nums text-white">{stats.created_problem_count}개</span>
        </div>
      </section>

      {/* Weak categories */}
      <section>
        <p className="mb-3 text-2xs font-semibold uppercase tracking-widest text-ink-600">약점 카테고리 TOP 3</p>
        {weak_categories.length === 0 ? (
          <EmptyState text="아직 데이터가 부족해요. 문제를 더 풀어보세요." />
        ) : (
          <div className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink-800">
            {weak_categories.map((c) => {
              const cfg = CATEGORY_CONFIG[c.category as Category];
              const pct = Math.round(c.wrong_rate * 100);
              return (
                <div key={c.category} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs font-medium w-20 shrink-0 ${cfg?.tw.split(" ")[0] ?? "text-ink-400"}`}>
                    {cfg?.label ?? c.category}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-ink-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-2xs tabular-nums text-ink-500 shrink-0 w-20 text-right">
                    {c.wrong}/{c.total} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Weak concepts */}
      <section>
        <p className="mb-3 text-2xs font-semibold uppercase tracking-widest text-ink-600">자주 틀리는 개념 TOP 5</p>
        {weak_concepts.length === 0 ? (
          <EmptyState text="아직 자주 틀리는 개념이 없어요." />
        ) : (
          <ul className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink-800">
            {weak_concepts.map((wc, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-ink-800 text-2xs flex items-center justify-center text-ink-400 font-medium">
                  {i + 1}
                </span>
                <p className="flex-1 text-xs text-ink-300 leading-relaxed">{wc.concept}</p>
                <span className="shrink-0 text-2xs tabular-nums text-red-400">×{wc.wrong}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent wrong notes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-2xs font-semibold uppercase tracking-widest text-ink-600">최근 오답</p>
          <Link to="/wrong-notes" className="text-2xs text-sky-500 hover:text-sky-400 transition-colors no-underline">
            전체 보기 →
          </Link>
        </div>
        {recent_wrong_notes.length === 0 ? (
          <EmptyState text="오답이 없어요. 잘하고 있네요!" />
        ) : (
          <ul className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink-800">
            {recent_wrong_notes.map((w) => {
              const cfg = CATEGORY_CONFIG[w.category as Category];
              return (
                <li key={w.submission_id}>
                  <Link
                    to={`/problems/${w.problem_id}`}
                    className="flex items-start gap-3 px-4 py-3 no-underline hover:bg-ink-800/30 transition-colors"
                  >
                    <span className={`shrink-0 mt-0.5 inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-medium ${cfg?.tw ?? "text-ink-400 border-ink-700"}`}>
                      {cfg?.label ?? w.category}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink-200 truncate">{w.problem_title}</p>
                      <p className="mt-0.5 text-2xs text-ink-600 truncate">
                        제출: <span className="font-mono text-ink-500">{w.user_answer || "(빈 답)"}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-800 bg-ink-900/30 py-8 text-center">
      <p className="text-xs text-ink-600">{text}</p>
    </div>
  );
}

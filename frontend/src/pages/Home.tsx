import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL, apiFetch } from "../api";
import { CATEGORY_CONFIG } from "../constants";
import { useAuth } from "../context/AuthContext";
import { computeGuestStats, GuestStats } from "../lib/guestStore";
import type { AnalysisData, StatsData } from "../types";

const FEATURES = [
  {
    to: "/problems",
    icon: "▤",
    title: "문제 목록",
    desc: "10개 카테고리, 3단계 난이도",
  },
  {
    to: "/quiz",
    icon: "◎",
    title: "개념 퀴즈",
    desc: "OX · 객관식 · 단답형 개념 점검",
  },
  {
    to: "/generate",
    icon: "◈",
    title: "AI 문제 생성",
    desc: "카테고리/난이도 지정 후 즉시 생성",
    auth: true,
  },
  {
    to: "/wrong-notes",
    icon: "⊘",
    title: "오답노트",
    desc: "틀린 문제와 AI 피드백 복습",
    auth: true,
  },
  {
    to: "/stats",
    icon: "◫",
    title: "학습 통계",
    desc: "정답률, 카테고리별 현황 분석",
    auth: true,
  },
];

const TERMINAL_LINES = [
  { prompt: true, text: "ls -la /etc/nginx/sites-enabled/" },
  { prompt: false, text: "total 8" },
  { prompt: false, text: "drwxr-xr-x 2 root root 4096 Jan  1 00:00 ." },
  { prompt: false, text: "-rw-r--r-- 1 root root  126 Jan  1 00:00 default" },
  { prompt: true, text: "chmod 755 deploy.sh" },
  { prompt: false, text: "" },
  { prompt: true, text: "find / -name '*.log' -mtime +7 | wc -l" },
  { prompt: false, text: "42" },
];

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [guest, setGuest] = useState<GuestStats | null>(null);
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => setHealth(r.ok ? "ok" : "error"))
      .catch(() => setHealth("error"));

    if (user) {
      apiFetch("/stats")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setStats)
        .catch(() => {});
      apiFetch("/analysis")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setAnalysis)
        .catch(() => {});
    } else {
      setGuest(computeGuestStats());
    }
  }, [user]);

  const features = user ? FEATURES : FEATURES.filter((f) => !f.auth);

  return (
    <div className="space-y-10 max-w-3xl mx-auto">

      {/* Hero */}
      <section className="pt-2">
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              health === "ok"
                ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-400"
                : health === "error"
                ? "border-red-500/25 bg-red-500/5 text-red-400"
                : "border-ink-700 text-ink-600"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${health === "ok" ? "bg-emerald-500" : health === "error" ? "bg-red-500" : "bg-ink-600"}`} />
            {health === "ok" ? "서버 정상" : health === "error" ? "서버 오프라인" : "확인 중"}
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-white leading-tight">
          리눅스 명령어,<br />
          <span className="text-ink-500">코치와 함께 배워요.</span>
        </h1>
        <p className="mt-3 text-sm text-ink-500 max-w-md leading-relaxed">
          문제를 풀고, 틀리면 AI 피드백으로 방향을 잡고, 오답노트로 복습하세요.
          실제 터미널 환경에서 CLI를 익히는 가장 빠른 방법입니다.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <Link
            to="/problems"
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors no-underline"
          >
            문제 풀기 시작
            <span aria-hidden>→</span>
          </Link>
          {!user && (
            <Link
              to="/quiz"
              className="inline-flex items-center gap-2 rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-300 hover:border-ink-500 hover:text-white transition-colors no-underline"
            >
              퀴즈 풀기
            </Link>
          )}
        </div>
      </section>

      {/* Stats (when logged in) */}
      {user && stats && (
        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-600">내 학습 현황</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "총 문제", value: stats.total_problems },
              { label: "총 제출", value: stats.total_submissions },
              { label: "정답", value: stats.correct_submissions },
              { label: "정답률", value: `${stats.accuracy}%` },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-ink-800 bg-ink-900 p-3">
                <p className="text-xl font-semibold tabular-nums text-white">{c.value}</p>
                <p className="mt-0.5 text-xs text-ink-600">{c.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Guest dashboard (when not logged in & has activity) */}
      {!user && guest && guest.total_submissions > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-widest text-ink-600">Guest 학습 현황</p>
            <span className="text-2xs text-ink-700 italic">이 브라우저에 저장됨</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "오늘 풀이", value: guest.today_solved, hi: guest.today_solved > 0 },
              { label: "연속 일수", value: `${guest.streak_days}일`, hi: guest.streak_days > 0 },
              { label: "총 제출", value: guest.total_submissions },
              { label: "정답률", value: `${guest.accuracy}%` },
              { label: "답 본 문제", value: guest.viewed_answer_count },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-ink-800 bg-ink-900 p-3">
                <p className={`text-xl font-semibold tabular-nums ${c.hi ? "text-emerald-400" : "text-white"}`}>
                  {c.value}
                </p>
                <p className="mt-0.5 text-2xs text-ink-600">{c.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Guest weak categories */}
      {!user && guest && guest.weak_categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-widest text-ink-600">내 약점 카테고리</p>
            <Link to="/quiz" className="text-2xs text-sky-500 hover:text-sky-400 no-underline">퀴즈로 보완 →</Link>
          </div>
          <div className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink-800">
            {guest.weak_categories.map((c) => {
              const cfg = CATEGORY_CONFIG[c.category as keyof typeof CATEGORY_CONFIG];
              const pct = Math.round(c.wrong_rate * 100);
              return (
                <div key={c.category} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs font-medium ${cfg?.tw.split(" ")[0] ?? "text-ink-400"} w-16 shrink-0`}>
                    {cfg?.label ?? c.category}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-ink-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-2xs tabular-nums text-ink-500 w-16 text-right shrink-0">
                    {c.wrong}/{c.total} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent wrong (guest) */}
      {!user && guest && guest.recent_wrong.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-600">최근 오답</p>
          <ul className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink-800">
            {guest.recent_wrong.slice(0, 3).map((w) => {
              const cfg = CATEGORY_CONFIG[w.category as keyof typeof CATEGORY_CONFIG];
              return (
                <li key={`${w.problem_id}-${w.submitted_at}`}>
                  <Link
                    to={`/problems/${w.problem_id}`}
                    className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-ink-800/30 transition-colors"
                  >
                    <span className={`shrink-0 inline-flex rounded border px-1.5 py-0.5 text-2xs font-medium ${cfg?.tw ?? "text-ink-400 border-ink-700"}`}>
                      {cfg?.label ?? w.category}
                    </span>
                    <span className="flex-1 text-sm text-ink-200 truncate">{w.problem_title}</span>
                    <span className="shrink-0 font-mono text-2xs text-red-400 truncate max-w-[140px]">{w.user_answer}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Weakness analysis (when logged in + data available) */}
      {user && analysis && analysis.weak_categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-widest text-ink-600">약점 카테고리</p>
            <Link
              to="/quiz"
              className="text-2xs text-sky-500 hover:text-sky-400 transition-colors no-underline"
            >
              퀴즈로 보완 →
            </Link>
          </div>
          <div className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink-800">
            {analysis.weak_categories.slice(0, 4).map((cat) => {
              const cfg = CATEGORY_CONFIG[cat.category as keyof typeof CATEGORY_CONFIG];
              const pct = Math.round(cat.wrong_rate * 100);
              return (
                <div key={cat.category} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs font-medium ${cfg?.tw.split(" ")[0] ?? "text-ink-400"} w-16 shrink-0`}>
                    {cfg?.label ?? cat.category}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-ink-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-ink-500 w-10 text-right shrink-0">
                    {pct}% 오답
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Terminal preview */}
      <section>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-600">이런 문제들을 풀어요</p>
        <div className="rounded-lg border border-ink-800 bg-ink-950 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-ink-800 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            <span className="ml-3 text-xs text-ink-600 font-mono">bash — 80×24</span>
          </div>
          <div className="px-4 py-4 space-y-0.5 font-mono text-sm">
            {TERMINAL_LINES.map((line, i) => (
              <div key={i} className="flex gap-2">
                {line.prompt ? (
                  <>
                    <span className="text-emerald-400 select-none shrink-0">$</span>
                    <span className="text-ink-200">{line.text}</span>
                  </>
                ) : (
                  <span className="text-ink-500 pl-5">{line.text}</span>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <span className="text-emerald-400 select-none">$</span>
              <span className="inline-block w-2 h-4 bg-emerald-400/70 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-600">기능</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {features.map((f) => (
            <Link
              key={f.to}
              to={f.to}
              className="group flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-900 p-4 no-underline hover:border-ink-700 transition-colors"
            >
              <span className="shrink-0 mt-0.5 text-lg font-mono text-ink-600 group-hover:text-ink-400 transition-colors">
                {f.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-ink-200 group-hover:text-white transition-colors">{f.title}</p>
                <p className="mt-0.5 text-xs text-ink-600">{f.desc}</p>
              </div>
            </Link>
          ))}
          {!user && (
            <Link
              to="/register"
              className="group flex items-start gap-3 rounded-lg border border-dashed border-ink-800 bg-transparent p-4 no-underline hover:border-ink-600 transition-colors"
            >
              <span className="shrink-0 mt-0.5 text-lg font-mono text-ink-700 group-hover:text-ink-500 transition-colors">+</span>
              <div>
                <p className="text-sm font-medium text-ink-600 group-hover:text-ink-400 transition-colors">가입하면 더 많은 기능이</p>
                <p className="mt-0.5 text-xs text-ink-700">AI 생성, 오답노트, 통계 등</p>
              </div>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

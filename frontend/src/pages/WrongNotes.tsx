import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, fetchAppConfig } from "../api";
import { CATEGORY_CONFIG, DIFFICULTY_CONFIG } from "../constants";
import { useAuth } from "../context/AuthContext";
import { computeGuestStats, GuestSubmission } from "../lib/guestStore";
import type { AppConfig, WrongNote } from "../types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// Convert guest submission → WrongNote-like shape for unified rendering
function guestToNote(s: GuestSubmission, idx: number): WrongNote {
  return {
    submission_id: -(idx + 1), // negative to avoid clash
    problem_id: s.problem_id,
    problem_title: s.problem_title,
    problem_question: s.problem_question ?? "",
    category: s.category as WrongNote["category"],
    difficulty: (s.difficulty ?? "easy") as WrongNote["difficulty"],
    problem_type: (s.problem_type ?? "command") as WrongNote["problem_type"],
    user_answer: s.user_answer,
    feedback: s.feedback,
    submitted_at: s.submitted_at,
  };
}

export default function WrongNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    fetchAppConfig().then(setCfg);

    if (user) {
      apiFetch("/wrong-notes")
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((d: WrongNote[]) => {
          setNotes(d);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    } else {
      // Guest mode: read from localStorage
      const stats = computeGuestStats();
      const guestNotes = stats.recent_wrong.map((s, i) => guestToNote(s, i));
      setNotes(guestNotes);
      setIsGuest(true);
      setLoading(false);
    }
  }, [user]);

  const coachLabel = cfg?.mode === "ai" ? "AI 코치" : "코치";

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse max-w-2xl">
        <div className="h-6 w-28 rounded bg-ink-800" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-lg bg-ink-900" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">오답노트</h1>
          <p className="mt-0.5 text-xs text-ink-600">
            {error ? "" : `${notes.length}개 기록`}
            {isGuest && (
              <span className="ml-2 text-amber-400/70">· Guest Mode (이 브라우저에 저장됨)</span>
            )}
          </p>
        </div>
        {!user && (
          <Link
            to="/login"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-400 hover:border-ink-500 hover:text-white transition-colors no-underline"
          >
            로그인하면 서버에 저장 →
          </Link>
        )}
      </div>

      {/* Guest note: limited to recent 5 */}
      {isGuest && notes.length > 0 && (
        <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-300/80 leading-relaxed">
            로그인하지 않은 상태에서의 오답 기록은 <strong>이 브라우저에만</strong> 저장되며 최근 5개만 표시됩니다.
            더 많은 기록과 AI 피드백을 원하면{" "}
            <Link to="/login" className="text-sky-400 hover:text-sky-300 no-underline">로그인</Link>하세요.
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-ink-800 py-16 text-center">
          <p className="text-sm text-ink-500">데이터를 불러올 수 없습니다.</p>
        </div>
      )}

      {!error && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-ink-800 bg-ink-900/50 py-16 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-sm font-medium text-ink-300">오답 기록 없음</p>
          <p className="mt-1 text-xs text-ink-600">모든 문제를 맞혔거나 아직 풀지 않았어요</p>
          <Link
            to="/problems"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-xs font-medium text-ink-950 hover:bg-ink-100 transition-colors no-underline"
          >
            문제 풀러 가기 →
          </Link>
        </div>
      )}

      {!error && notes.length > 0 && (
        <ul className="space-y-3">
          {notes.map((note) => {
            const cat = CATEGORY_CONFIG[note.category] ?? { label: note.category, tw: "text-ink-400 border-ink-700" };
            const diff = DIFFICULTY_CONFIG[note.difficulty] ?? DIFFICULTY_CONFIG.easy;
            return (
              <li key={note.submission_id} className="rounded-lg border border-ink-800 bg-ink-900 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-2xs font-medium ${cat.tw}`}>{cat.label}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-2xs font-medium ${diff.tw}`}>{diff.label}</span>
                    <span className="text-2xs text-ink-700">{fmtDate(note.submitted_at)}</span>
                  </div>
                  <Link
                    to={`/problems/${note.problem_id}`}
                    className="text-xs text-ink-500 hover:text-white transition-colors no-underline shrink-0"
                  >
                    다시 풀기 →
                  </Link>
                </div>

                <div className="px-4 py-3 space-y-3">
                  <p className="text-sm font-medium text-ink-200">{note.problem_title}</p>

                  <div>
                    <p className="mb-1 text-2xs font-medium uppercase tracking-widest text-ink-700">내 오답</p>
                    <div className="flex items-center gap-2 rounded-md border border-red-500/15 bg-red-500/5 px-3 py-2 font-mono text-sm">
                      <span className="text-red-500 select-none text-xs">$</span>
                      <span className="text-red-200/80">{note.user_answer}</span>
                    </div>
                  </div>

                  {note.feedback && (
                    <div className="rounded-md border border-ink-800 bg-ink-950/60 px-3 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-2xs font-semibold uppercase tracking-wider text-sky-400">{coachLabel}</span>
                        <span className="h-px flex-1 bg-ink-800" />
                      </div>
                      <p className="text-xs text-ink-400 leading-relaxed whitespace-pre-wrap">{note.feedback}</p>
                    </div>
                  )}

                  {isGuest && !note.feedback && (
                    <p className="text-2xs text-ink-700 italic">피드백은 문제 제출 시 표시됩니다.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

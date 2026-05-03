import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, fetchAppConfig } from "../api";
import { CATEGORY_CONFIG, DIFFICULTY_CONFIG } from "../constants";
import type { AppConfig, WrongNote } from "../types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function WrongNotes() {
  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
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
  }, []);

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
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">오답노트</h1>
        <p className="mt-0.5 text-xs text-ink-600">
          {error ? "" : `${notes.length}개 기록`}
        </p>
      </div>

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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Guest mode store — persists learning state in localStorage so users can
 * use the app without registering/logging in.
 *
 * Schema is intentionally flat & simple. Keys are namespaced under `lc.guest.*`.
 */

export interface GuestSubmission {
  problem_id: number;
  category: string;
  difficulty: string;
  problem_type: "command" | "quiz" | string;
  user_answer: string;
  is_correct: boolean;
  problem_title: string;
  problem_question: string;
  feedback: string | null;
  submitted_at: string; // ISO
}

const KEY_SUBMISSIONS = "lc.guest.submissions";
const KEY_VIEWED_ANSWERS = "lc.guest.viewedAnswers";
const KEY_API_PROVIDER = "lc.user.aiProvider";   // "openai" | "gemini" | ""
const KEY_API_KEY = "lc.user.aiKey";              // raw key, browser-only

// ── Submissions ───────────────────────────────────────────────────────────────

export function getGuestSubmissions(): GuestSubmission[] {
  try {
    const raw = localStorage.getItem(KEY_SUBMISSIONS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordGuestSubmission(s: GuestSubmission): void {
  const all = getGuestSubmissions();
  all.unshift(s);
  // Cap at 500 to keep localStorage tame
  const capped = all.slice(0, 500);
  try {
    localStorage.setItem(KEY_SUBMISSIONS, JSON.stringify(capped));
  } catch {
    // quota exceeded — drop older entries
    try {
      localStorage.setItem(KEY_SUBMISSIONS, JSON.stringify(capped.slice(0, 200)));
    } catch {/* ignore */}
  }
}

export function clearGuestSubmissions(): void {
  localStorage.removeItem(KEY_SUBMISSIONS);
}

// ── Viewed answers ────────────────────────────────────────────────────────────

export function getViewedAnswers(): Set<number> {
  try {
    const raw = localStorage.getItem(KEY_VIEWED_ANSWERS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markAnswerViewed(problemId: number): void {
  const set = getViewedAnswers();
  set.add(problemId);
  localStorage.setItem(KEY_VIEWED_ANSWERS, JSON.stringify(Array.from(set)));
}

// ── Derived stats ─────────────────────────────────────────────────────────────

export interface GuestStats {
  total_submissions: number;
  correct_count: number;
  wrong_count: number;
  accuracy: number;
  solved_problem_ids: number[];
  viewed_answer_count: number;
  recent_wrong: GuestSubmission[];
  weak_categories: { category: string; total: number; wrong: number; wrong_rate: number }[];
  weak_concepts: { concept: string; wrong: number }[];
  today_solved: number;
  streak_days: number;
}

export function computeGuestStats(): GuestStats {
  const subs = getGuestSubmissions();
  const total = subs.length;
  const correct = subs.filter((s) => s.is_correct).length;
  const wrong = total - correct;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  // solved set = unique problem ids ever answered correctly
  const solved = new Set<number>();
  subs.forEach((s) => { if (s.is_correct) solved.add(s.problem_id); });

  // weak categories
  const catTotal: Record<string, number> = {};
  const catWrong: Record<string, number> = {};
  const conceptWrong: Record<string, number> = {};
  subs.forEach((s) => {
    catTotal[s.category] = (catTotal[s.category] ?? 0) + 1;
    if (!s.is_correct) {
      catWrong[s.category] = (catWrong[s.category] ?? 0) + 1;
      // We don't store concept on submission; fallback to title for grouping
      const k = s.problem_title;
      if (k) conceptWrong[k] = (conceptWrong[k] ?? 0) + 1;
    }
  });
  const weak_categories = Object.entries(catTotal)
    .filter(([, t]) => t >= 2)
    .map(([category, t]) => {
      const w = catWrong[category] ?? 0;
      return { category, total: t, wrong: w, wrong_rate: t ? +(w / t).toFixed(3) : 0 };
    })
    .sort((a, b) => b.wrong_rate - a.wrong_rate || b.wrong - a.wrong)
    .slice(0, 3);

  const weak_concepts = Object.entries(conceptWrong)
    .map(([concept, wr]) => ({ concept, wrong: wr }))
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 5);

  // Today / streak (UTC date)
  const todayStr = new Date().toISOString().slice(0, 10);
  const today_solved = subs.filter(
    (s) => s.is_correct && s.submitted_at.slice(0, 10) === todayStr
  ).length;

  const dates = new Set<string>();
  subs.forEach((s) => {
    if (s.is_correct) dates.add(s.submitted_at.slice(0, 10));
  });
  let streak = 0;
  // Walk back from today (or yesterday if nothing today)
  let cursor = new Date();
  if (!dates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const recent_wrong = subs.filter((s) => !s.is_correct).slice(0, 5);

  return {
    total_submissions: total,
    correct_count: correct,
    wrong_count: wrong,
    accuracy,
    solved_problem_ids: Array.from(solved),
    viewed_answer_count: getViewedAnswers().size,
    recent_wrong,
    weak_categories,
    weak_concepts,
    today_solved,
    streak_days: streak,
  };
}

// ── User AI key (browser-only) ────────────────────────────────────────────────

export type AIProvider = "openai" | "gemini" | "";

export function getUserAIKey(): { provider: AIProvider; key: string } {
  return {
    provider: (localStorage.getItem(KEY_API_PROVIDER) as AIProvider) || "",
    key: localStorage.getItem(KEY_API_KEY) || "",
  };
}

export function setUserAIKey(provider: AIProvider, key: string): void {
  if (!provider || !key.trim()) {
    clearUserAIKey();
    return;
  }
  localStorage.setItem(KEY_API_PROVIDER, provider);
  localStorage.setItem(KEY_API_KEY, key.trim());
}

export function clearUserAIKey(): void {
  localStorage.removeItem(KEY_API_PROVIDER);
  localStorage.removeItem(KEY_API_KEY);
}

// ── Mode resolution ───────────────────────────────────────────────────────────

export type CoachMode =
  | "free_rule"   // Free Rule Mode (no key anywhere)
  | "user_ai"    // User AI Mode (browser key)
  | "admin_ai";  // Admin AI Mode (server key)

export function resolveCoachMode(serverAIEnabled: boolean): CoachMode {
  const { provider, key } = getUserAIKey();
  if (provider && key) return "user_ai";
  if (serverAIEnabled) return "admin_ai";
  return "free_rule";
}

export function coachModeLabel(m: CoachMode): string {
  switch (m) {
    case "user_ai": return "User AI Mode";
    case "admin_ai": return "Admin AI Mode";
    default: return "Free Rule Mode";
  }
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import { useAuth } from "../context/AuthContext";
import type { Category, Difficulty, Problem, SubmitResult } from "../types";

type Screen = "setup" | "quiz" | "result";

interface SessionResult {
  total: number;
  correct: number;
  wrong: Problem[];
}

// ── Setup screen ──────────────────────────────────────────────────────────────

function SetupScreen({
  onStart,
}: {
  onStart: (category: Category | "all", difficulty: Difficulty | "all") => void;
}) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");

  return (
    <div className="max-w-md mx-auto space-y-7">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">개념 퀴즈</h1>
        <p className="mt-0.5 text-xs text-ink-600">
          객관식·OX·단답형으로 리눅스 개념을 빠르게 점검해요
        </p>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900 p-5 space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium text-ink-400">카테고리</label>
          <div className="flex flex-wrap gap-1.5">
            <FilterBtn active={category === "all"} onClick={() => setCategory("all")}>전체</FilterBtn>
            {CATEGORY_ORDER.map((cat) => (
              <FilterBtn key={cat} active={category === cat} onClick={() => setCategory(cat)}>
                {CATEGORY_CONFIG[cat].label}
              </FilterBtn>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-ink-400">난이도</label>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "beginner", "easy", "medium"] as const).map((d) => (
              <FilterBtn key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                {d === "all" ? "전체" : DIFFICULTY_CONFIG[d]?.label ?? d}
              </FilterBtn>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onStart(category, difficulty)}
          className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors"
        >
          퀴즈 시작
        </button>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900/50 p-4">
        <p className="text-xs font-medium text-ink-500 mb-2">퀴즈 유형</p>
        <div className="space-y-1.5 text-xs text-ink-600">
          <div className="flex items-center gap-2"><span className="w-14 shrink-0 font-mono text-sky-400">MC</span> 4개 보기 중 하나 선택</div>
          <div className="flex items-center gap-2"><span className="w-14 shrink-0 font-mono text-emerald-400">OX</span> 맞으면 O, 틀리면 X</div>
          <div className="flex items-center gap-2"><span className="w-14 shrink-0 font-mono text-amber-400">단답형</span> 짧은 단어/명령어 입력</div>
        </div>
      </div>
    </div>
  );
}

// ── Quiz card ─────────────────────────────────────────────────────────────────

function QuizCard({
  problem,
  index,
  total,
  onAnswer,
}: {
  problem: Problem;
  index: number;
  total: number;
  onAnswer: (answer: string, correct: boolean, result: SubmitResult) => void;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [fillInput, setFillInput] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const choices: string[] = useMemo(() => {
    if (!problem.choices) return [];
    try { return JSON.parse(problem.choices); } catch { return []; }
  }, [problem.choices]);

  const quizType = problem.quiz_type ?? "fill";

  async function submit(answer: string) {
    if (submitting || result) return;
    setSubmitting(true);
    try {
      let res: SubmitResult;
      if (user) {
        const r = await apiFetch(`/problems/${problem.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_answer: answer }),
        });
        res = await r.json();
      } else {
        // Client-side grading when not logged in
        const correct = answer.trim().toLowerCase() === problem.answer.trim().toLowerCase();
        res = {
          is_correct: correct,
          message: correct ? "정답입니다!" : "오답입니다.",
          correct_answer: !correct ? problem.answer : undefined,
        };
      }
      setResult(res);
      onAnswer(answer, res.is_correct, res);
    } finally {
      setSubmitting(false);
    }
  }

  function handleMC(choice: string) {
    if (result) return;
    setSelected(choice);
    submit(choice);
  }

  function handleOX(val: string) {
    if (result) return;
    setSelected(val);
    submit(val);
  }

  function handleFillSubmit() {
    if (!fillInput.trim() || result) return;
    submit(fillInput.trim());
  }

  const cat = CATEGORY_CONFIG[problem.category];
  const diff = DIFFICULTY_CONFIG[problem.difficulty as keyof typeof DIFFICULTY_CONFIG];
  const progress = Math.round((index / total) * 100);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-ink-600">
          <span>{index + 1} / {total}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 rounded-full bg-ink-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-lg border border-ink-800 bg-ink-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-2.5">
          <span className={`rounded border px-1.5 py-0.5 text-2xs font-medium ${cat?.tw ?? "text-ink-400 border-ink-700"}`}>
            {cat?.label ?? problem.category}
          </span>
          {diff && (
            <span className={`rounded border px-1.5 py-0.5 text-2xs font-medium ${diff.tw}`}>
              {diff.label}
            </span>
          )}
          <span className={`ml-auto text-2xs font-mono font-medium ${
            quizType === "mc" ? "text-sky-400" : quizType === "ox" ? "text-emerald-400" : "text-amber-400"
          }`}>
            {quizType === "mc" ? "MC" : quizType === "ox" ? "OX" : "단답형"}
          </span>
        </div>

        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-ink-200 leading-relaxed">{problem.question}</p>

          {/* MC choices */}
          {quizType === "mc" && (
            <div className="space-y-2">
              {choices.map((choice, i) => {
                const isSelected = selected === choice;
                const isCorrect = result && choice === problem.answer;
                const isWrong = result && isSelected && !result.is_correct;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!!result || submitting}
                    onClick={() => handleMC(choice)}
                    className={[
                      "w-full flex items-center gap-3 rounded-md border px-4 py-3 text-sm text-left transition-colors",
                      isCorrect
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : isWrong
                        ? "border-red-500/40 bg-red-500/10 text-red-300"
                        : isSelected
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        : "border-ink-800 bg-ink-950/50 text-ink-300 hover:border-ink-600 hover:text-white",
                      result ? "cursor-default" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-medium">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {choice}
                    {isCorrect && <span className="ml-auto text-emerald-400 text-xs">✓</span>}
                    {isWrong && <span className="ml-auto text-red-400 text-xs">✗</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* OX */}
          {quizType === "ox" && (
            <div className="grid grid-cols-2 gap-3">
              {["O", "X"].map((val) => {
                const isSelected = selected === val;
                const isCorrect = result && val === problem.answer;
                const isWrong = result && isSelected && !result.is_correct;
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={!!result || submitting}
                    onClick={() => handleOX(val)}
                    className={[
                      "rounded-lg border py-5 text-2xl font-bold transition-colors",
                      isCorrect
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : isWrong
                        ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : isSelected
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                        : val === "O"
                        ? "border-ink-800 text-emerald-400/40 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                        : "border-ink-800 text-red-400/40 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400",
                      result ? "cursor-default" : "cursor-pointer",
                    ].join(" ")}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          )}

          {/* Fill */}
          {quizType === "fill" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={fillInput}
                  onChange={(e) => setFillInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFillSubmit()}
                  disabled={!!result || submitting}
                  placeholder="답을 입력하고 Enter"
                  autoFocus
                  className={[
                    "flex-1 rounded-md border bg-ink-950 px-3 py-2 text-sm font-mono text-ink-100 outline-none transition-colors placeholder:text-ink-700",
                    result
                      ? result.is_correct
                        ? "border-emerald-500/40"
                        : "border-red-500/40"
                      : "border-ink-700 focus:border-ink-500",
                  ].join(" ")}
                />
                {!result && (
                  <button
                    type="button"
                    onClick={handleFillSubmit}
                    disabled={!fillInput.trim() || submitting}
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-40 transition-colors"
                  >
                    확인
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      {result && (
        <div className={`rounded-lg border px-4 py-3 space-y-2 ${
          result.is_correct ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${result.is_correct ? "text-emerald-300" : "text-red-300"}`}>
              {result.is_correct ? "✓ 정답!" : "✗ 오답"}
            </span>
            {!result.is_correct && result.correct_answer && (
              <span className="text-xs text-ink-500">
                정답: <span className="font-mono text-ink-300">{result.correct_answer}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-ink-500 leading-relaxed">{problem.concept}</p>
        </div>
      )}
    </div>
  );
}

// ── Result screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  result,
  onRetry,
  onNew,
}: {
  result: SessionResult;
  onRetry: () => void;
  onNew: () => void;
}) {
  const accuracy = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-6 text-center space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-ink-600 mb-1">세션 완료</p>
          <p className="text-4xl font-bold tabular-nums text-white">{accuracy}%</p>
          <p className="text-sm text-ink-500 mt-1">정확도</p>
        </div>

        <div className="h-2 rounded-full bg-ink-950 overflow-hidden mx-4">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              accuracy >= 80 ? "bg-emerald-500" : accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${accuracy}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-lg font-semibold text-white">{result.total}</p>
            <p className="text-xs text-ink-600">총 문제</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-emerald-400">{result.correct}</p>
            <p className="text-xs text-ink-600">정답</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-red-400">{result.total - result.correct}</p>
            <p className="text-xs text-ink-600">오답</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNew}
          className="flex-1 rounded-md bg-white py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors"
        >
          새 퀴즈 시작
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-md border border-ink-700 py-2.5 text-sm font-medium text-ink-300 hover:border-ink-500 hover:text-white transition-colors"
        >
          같은 설정으로 재시도
        </button>
      </div>

      <Link
        to="/"
        className="block text-center text-xs text-ink-600 hover:text-ink-300 transition-colors no-underline"
      >
        대시보드로 돌아가기
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuizMode() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionResult, setSessionResult] = useState<SessionResult>({ total: 0, correct: 0, wrong: [] });
  const [loading, setLoading] = useState(false);
  const [lastCategory, setLastCategory] = useState<Category | "all">("all");
  const [lastDifficulty, setLastDifficulty] = useState<Difficulty | "all">("all");

  async function startQuiz(category: Category | "all", difficulty: Difficulty | "all") {
    setLoading(true);
    setLastCategory(category);
    setLastDifficulty(difficulty);

    const params = new URLSearchParams({ problem_type: "quiz" });
    const r = await apiFetch(`/problems?${params}`);
    let all: Problem[] = await r.json().catch(() => []);

    if (category !== "all") all = all.filter((p) => p.category === category);
    if (difficulty !== "all") all = all.filter((p) => p.difficulty === difficulty);

    // Shuffle and take up to 20
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 20);

    setProblems(shuffled);
    setCurrentIndex(0);
    setSessionResult({ total: shuffled.length, correct: 0, wrong: [] });
    setLoading(false);

    if (shuffled.length === 0) return;
    setScreen("quiz");
  }

  function handleAnswer(answer: string, correct: boolean, res: SubmitResult) {
    setSessionResult((prev) => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      wrong: correct ? prev.wrong : [...prev.wrong, problems[currentIndex]],
    }));
  }

  function handleNext() {
    if (currentIndex + 1 >= problems.length) {
      setScreen("result");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-24 gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-ink-600 border-t-sky-400 animate-spin" />
        <p className="text-xs text-ink-600">퀴즈를 불러오는 중…</p>
      </div>
    );
  }

  if (screen === "setup" || (screen === "quiz" && problems.length === 0)) {
    return (
      <>
        <SetupScreen onStart={startQuiz} />
        {screen === "quiz" && problems.length === 0 && (
          <p className="text-center text-xs text-ink-500 mt-4">해당 조건의 퀴즈 문제가 없습니다.</p>
        )}
      </>
    );
  }

  if (screen === "result") {
    return (
      <ResultScreen
        result={sessionResult}
        onNew={() => setScreen("setup")}
        onRetry={() => startQuiz(lastCategory, lastDifficulty)}
      />
    );
  }

  const currentProblem = problems[currentIndex];

  return (
    <div className="space-y-4">
      <QuizCard
        key={currentProblem.id}
        problem={currentProblem}
        index={currentIndex}
        total={problems.length}
        onAnswer={handleAnswer}
      />
      <div className="max-w-lg mx-auto">
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-md border border-ink-700 py-2.5 text-sm font-medium text-ink-300 hover:border-ink-500 hover:text-white transition-colors"
        >
          {currentIndex + 1 >= problems.length ? "결과 보기" : "다음 →"}
        </button>
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

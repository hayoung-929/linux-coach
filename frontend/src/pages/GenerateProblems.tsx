import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, fetchAppConfig } from "../api";
import { CATEGORY_CONFIG, CATEGORY_ORDER, DIFFICULTY_CONFIG } from "../constants";
import type { AppConfig, Category, Difficulty, GenerateResponse, Problem } from "../types";

type Status = "idle" | "loading" | "success" | "error";

function parseError(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x))).join(" ");
  }
  return "문제 생성 중 오류가 발생했습니다.";
}

export default function GenerateProblems() {
  const [category, setCategory] = useState<Category>("file");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [count, setCount] = useState(3);
  const [status, setStatus] = useState<Status>("idle");
  const [generated, setGenerated] = useState<Problem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, []);

  const isFree = cfg?.mode === "free";

  function handleGenerate() {
    setStatus("loading");
    setGenerated([]);
    setErrorMsg("");

    apiFetch("/generate-problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, difficulty, count }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(parseError(data.detail ?? data.message));
        return data as GenerateResponse;
      })
      .then((data) => {
        setGenerated(data.problems);
        setStatus("success");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message);
        setStatus("error");
      });
  }

  const catCfg = CATEGORY_CONFIG[category];
  const diffCfg = DIFFICULTY_CONFIG[difficulty];

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">문제 생성</h1>
        <p className="mt-0.5 text-xs text-ink-600">카테고리와 난이도를 지정해 새 문제를 생성합니다.</p>
      </div>

      {isFree && (
        <div className="rounded-md border border-amber-500/15 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-medium text-amber-300">무료 모드</p>
          <p className="mt-0.5 text-xs text-amber-200/60">내장 템플릿 기반으로 생성됩니다. OpenAI 또는 Gemini API 키를 설정하면 AI로 생성할 수 있습니다.</p>
        </div>
      )}

      <div className="rounded-lg border border-ink-800 bg-ink-900 p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={status === "loading"}
              className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-ink-500 transition-colors disabled:opacity-50"
            >
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-400">난이도</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              disabled={status === "loading"}
              className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-ink-500 transition-colors disabled:opacity-50"
            >
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => (
                <option key={d} value={d}>{DIFFICULTY_CONFIG[d].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-400">생성 개수 <span className="text-ink-700">(1–10)</span></label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            disabled={status === "loading"}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-ink-500 transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === "loading"}
          className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-ink-400 border-t-ink-700 animate-spin" />
              생성 중…
            </span>
          ) : "문제 생성"}
        </button>
      </div>

      {status === "error" && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-xs font-medium text-red-400 mb-0.5">생성 실패</p>
          <p className="text-xs text-ink-500 font-mono break-words">{errorMsg}</p>
        </div>
      )}

      {status === "success" && generated.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-400 font-medium">{generated.length}개 생성 완료</p>
            <Link to="/problems" className="text-xs text-ink-500 hover:text-white transition-colors no-underline">
              전체 목록 →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {generated.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/problems/${p.id}`}
                  className="flex items-center gap-3 rounded-md border border-ink-800 bg-ink-900 px-4 py-3 no-underline hover:border-ink-700 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-2xs rounded border px-1.5 py-0.5 font-medium ${catCfg.tw}`}>{catCfg.label}</span>
                      <span className={`text-2xs rounded border px-1.5 py-0.5 font-medium ${diffCfg.tw}`}>{diffCfg.label}</span>
                    </div>
                    <p className="text-sm font-medium text-ink-200 group-hover:text-white transition-colors truncate">{p.title}</p>
                  </div>
                  <span className="text-ink-700 group-hover:text-ink-400 transition-colors text-xs shrink-0">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

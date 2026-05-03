import type { Category, Difficulty } from "./types";

export const CATEGORY_ORDER: Category[] = [
  "file",
  "directory",
  "permission",
  "process",
  "network",
  "package",
  "service",
  "search",
  "compression",
  "environment",
];

export const CATEGORY_CONFIG: Record<
  Category,
  { label: string; icon: string; tw: string }
> = {
  file:          { label: "파일",       icon: "📄", tw: "text-sky-400 bg-sky-500/15 border-sky-500/25" },
  directory:     { label: "디렉터리", icon: "📁", tw: "text-cyan-400 bg-cyan-500/15 border-cyan-500/25" },
  permission:    { label: "권한",       icon: "🔐", tw: "text-amber-400 bg-amber-500/15 border-amber-500/25" },
  process:       { label: "프로세스", icon: "⚙️", tw: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25" },
  network:       { label: "네트워크", icon: "🌐", tw: "text-violet-400 bg-violet-500/15 border-violet-500/25" },
  package:       { label: "패키지",   icon: "📦", tw: "text-rose-400 bg-rose-500/15 border-rose-500/25" },
  service:       { label: "서비스",   icon: "🖥️", tw: "text-indigo-400 bg-indigo-500/15 border-indigo-500/25" },
  search:        { label: "검색",     icon: "🔎", tw: "text-teal-400 bg-teal-500/15 border-teal-500/25" },
  compression:   { label: "압축",     icon: "🗜️", tw: "text-orange-400 bg-orange-500/15 border-orange-500/25" },
  environment:   { label: "환경변수", icon: "🧩", tw: "text-lime-400 bg-lime-500/15 border-lime-500/25" },
};

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; tw: string }
> = {
  beginner: { label: "입문",   tw: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
  easy:     { label: "쉬움",   tw: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  medium:   { label: "보통",   tw: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  hard:     { label: "어려움", tw: "text-red-400 bg-red-500/10 border-red-500/20" },
};

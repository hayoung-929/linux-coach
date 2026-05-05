export type Category =
  | "file" | "directory" | "permission" | "process" | "network"
  | "package" | "service" | "search" | "compression" | "environment";

export type Difficulty = "beginner" | "easy" | "medium" | "hard";
export type ProblemType = "command" | "quiz";
export type QuizType = "mc" | "ox" | "fill";

export interface Problem {
  id: number;
  title: string;
  category: Category;
  difficulty: Difficulty;
  question: string;
  answer: string;
  hint: string;
  concept: string;
  ai_generated: boolean;
  problem_type: ProblemType;
  quiz_type?: QuizType | null;
  choices?: string | null;   // JSON string: string[]
  owner_id?: number | null;
  created_at: string;
}

export interface SubmitResult {
  is_correct: boolean;
  message: string;
  feedback?: string;
  correct_answer?: string | null;
}

export interface StatsData {
  total_problems: number;
  ai_problems: number;
  total_submissions: number;
  correct_submissions: number;
  wrong_submissions: number;
  accuracy: number;
}

export interface CategoryStat {
  category: string;
  total: number;
  wrong: number;
  wrong_rate: number;
}

export interface AnalysisData {
  weak_categories: CategoryStat[];
  total_submissions: number;
  overall_wrong_rate: number;
  solved_problem_ids: number[];
}

export interface GenerateRequest {
  category: Category;
  difficulty: Difficulty;
  count: number;
}

export interface GenerateResponse {
  problems: Problem[];
}

export interface WrongNote {
  submission_id: number;
  problem_id: number;
  problem_title: string;
  problem_question: string;
  category: Category;
  difficulty: Difficulty;
  problem_type: ProblemType;
  user_answer: string;
  feedback: string | null;
  submitted_at: string;
}

export interface AppConfig {
  mode: "ai" | "free";
  provider: string;
  label: string;
  ai_enabled: boolean;
  ai_mode: string;
  demo_email?: string | null;
  demo_password?: string | null;
}

export interface ProfileData {
  user: User;
  stats: {
    total_submissions: number;
    correct_count: number;
    wrong_count: number;
    accuracy: number;
    created_problem_count: number;
  };
  weak_categories: CategoryStat[];
  weak_concepts: { concept: string; wrong: number }[];
  recent_wrong_notes: WrongNote[];
  ai_mode: string;
  ai_enabled: boolean;
}

export interface User {
  id: number;
  email: string;
  username: string;
  /** True only for the seeded demo account — used to clear data on logout */
  is_demo: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

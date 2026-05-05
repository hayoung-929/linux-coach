from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Category = Literal[
    "file", "directory", "permission", "process", "network",
    "package", "service", "search", "compression", "environment",
]
Difficulty = Literal["beginner", "easy", "medium", "hard"]
ProblemType = Literal["command", "quiz"]
QuizType = Literal["mc", "ox", "fill"]


# ── Problem ───────────────────────────────────────────────────────────────────

class Problem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    difficulty: str
    question: str
    answer: str
    hint: str
    concept: str
    ai_generated: bool
    problem_type: str = "command"
    quiz_type: Optional[str] = None
    choices: Optional[str] = None  # JSON string
    owner_id: Optional[int] = None
    created_at: datetime


# ── Submission ────────────────────────────────────────────────────────────────

class Submission(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    problem_id: int
    user_id: Optional[int] = None
    user_answer: str
    is_correct: bool
    feedback: Optional[str] = None
    created_at: datetime


# ── WrongNote ─────────────────────────────────────────────────────────────────

class WrongNote(BaseModel):
    submission_id: int
    problem_id: int
    problem_title: str
    problem_question: str
    category: str
    difficulty: str
    problem_type: str = "command"
    user_answer: str
    feedback: Optional[str] = None
    submitted_at: datetime


# ── Analysis ──────────────────────────────────────────────────────────────────

class CategoryStat(BaseModel):
    category: str
    total: int
    wrong: int
    wrong_rate: float


class AnalysisResponse(BaseModel):
    weak_categories: list[CategoryStat]
    total_submissions: int
    overall_wrong_rate: float
    solved_problem_ids: list[int]


# ── Config ────────────────────────────────────────────────────────────────────

class AppConfigResponse(BaseModel):
    mode: Literal["ai", "free"]
    provider: str
    label: str
    ai_enabled: bool
    ai_mode: str  # "AI Mode" | "Free Rule Mode"
    demo_email: Optional[str] = None
    demo_password: Optional[str] = None


class ProfileResponse(BaseModel):
    user: "UserPublic"
    stats: dict
    weak_categories: list["CategoryStat"]
    weak_concepts: list[dict]
    recent_wrong_notes: list["WrongNote"]
    ai_mode: str
    ai_enabled: bool


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    is_demo: bool = False
    is_active: bool = True
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    username: str = Field(..., min_length=2, max_length=80)
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Change password ───────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=72)
    confirm_new_password: str


# ── Forgot / Reset password ───────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    message: str
    # Only populated in development mode (ENV != "production")
    dev_token: Optional[str] = None
    dev_reset_url: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=72)
    confirm_new_password: str


# ── Find account ──────────────────────────────────────────────────────────────

class FindAccountRequest(BaseModel):
    # Provide exactly one of: email or username
    email: Optional[str] = None
    username: Optional[str] = None


class FindAccountResponse(BaseModel):
    # When found by username → masked_email
    # When found by email   → username
    masked_email: Optional[str] = None
    username: Optional[str] = None
    message: str


# ── Update profile ────────────────────────────────────────────────────────────

class UpdateProfileRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=80)


# ── Delete account ────────────────────────────────────────────────────────────

class DeleteAccountRequest(BaseModel):
    password: str
    # Must be "DELETE" or "탈퇴합니다"
    confirm_text: str

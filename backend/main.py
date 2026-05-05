import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import delete as sa_delete, func, or_, select, text, update as sa_update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ai_config import app_mode_label, cloud_ai_provider
from app_errors import GeminiQuotaExceededError
from auth_utils import (
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    mask_email,
    verify_password,
    RESET_TOKEN_EXPIRE_MINUTES,
)
from database import AsyncSessionLocal, Base, engine, get_db
from db_models import PasswordResetTokenRow, ProblemRow, SubmissionRow, UserRow
from feedback import generate_feedback
from generate import generate_problems as ai_generate_problems
from grader import is_correct as grade
from models import (
    AnalysisResponse,
    AppConfigResponse,
    Category,
    CategoryStat,
    ChangePasswordRequest,
    DeleteAccountRequest,
    Difficulty,
    FindAccountRequest,
    FindAccountResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    Problem,
    ProfileResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserPublic,
    WrongNote,
)
from seed import (
    DEMO_EMAIL,
    DEMO_PASSWORD,
    DEMO_USERNAME,
    merge_new_seed_problems,
    seed_demo_user_if_missing,
    seed_if_empty,
)


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent column additions for rolling upgrades
        for stmt in [
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE",
            "ALTER TABLE problems ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE",
            "ALTER TABLE problems ADD COLUMN IF NOT EXISTS problem_type VARCHAR(20) DEFAULT 'command' NOT NULL",
            "ALTER TABLE problems ADD COLUMN IF NOT EXISTS quiz_type VARCHAR(20)",
            "ALTER TABLE problems ADD COLUMN IF NOT EXISTS choices TEXT",
            # is_demo: identifies the seeded demo account (used for data cleanup on logout)
            "ALTER TABLE users ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE",
            # Soft-delete support
            "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE users ADD COLUMN deleted_at DATETIME",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
    async with AsyncSessionLocal() as db:
        await seed_if_empty(db)
        await merge_new_seed_problems(db)
        await seed_demo_user_if_missing(db)
    yield


app = FastAPI(title="Linux Coach API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth helpers ─────────────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserRow]:
    from auth_utils import decode_token
    if not credentials:
        return None
    uid = decode_token(credentials.credentials)
    if uid is None:
        return None
    user = await db.get(UserRow, uid)
    # Deactivated (soft-deleted) accounts are treated as unauthenticated
    if user is None or not user.is_active:
        return None
    return user


async def require_user(
    user: Optional[UserRow] = Depends(get_current_user_optional),
) -> UserRow:
    if user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return user


# ── Health / Config ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "linux-coach-backend"}


@app.get("/config", response_model=AppConfigResponse)
def app_config():
    mode_id, label = app_mode_label()
    prov = cloud_ai_provider()
    ai_enabled = prov is not None
    return AppConfigResponse(
        mode="ai" if prov else "free",
        provider=prov or "rule_template",
        label=label,
        ai_enabled=ai_enabled,
        ai_mode="AI Mode" if ai_enabled else "Free Rule Mode",
        demo_email=DEMO_EMAIL,
        demo_password=DEMO_PASSWORD,
    )


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing_email = await db.scalar(
        select(UserRow).where(UserRow.email == body.email.lower())
    )
    if existing_email:
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")
    existing_username = await db.scalar(
        select(UserRow).where(UserRow.username == body.username)
    )
    if existing_username:
        raise HTTPException(status_code=409, detail="이미 사용 중인 사용자명입니다.")

    user = UserRow(
        email=body.email.lower(),
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@app.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(
        select(UserRow).where(UserRow.email == body.email.lower())
    )
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="탈퇴한 계정입니다. 새 계정을 만들어 주세요.")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@app.get("/auth/me", response_model=UserPublic)
async def me(current_user: UserRow = Depends(require_user)):
    return current_user


@app.delete("/auth/demo-data", status_code=204)
async def clear_demo_user_data(
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete all learning data for the demo account.

    Forbidden for regular (non-demo) users — protects real user data.
    Called by the frontend before the demo user logs out so they start
    fresh on next login.

    Deletes:
    - All submissions by the demo user
    - All AI-generated problems created by the demo user
    """
    if not current_user.is_demo:
        raise HTTPException(
            status_code=403,
            detail="데모 계정에서만 사용 가능합니다. 일반 사용자 데이터는 삭제되지 않습니다.",
        )
    await db.execute(sa_delete(SubmissionRow).where(SubmissionRow.user_id == current_user.id))
    await db.execute(sa_delete(ProblemRow).where(ProblemRow.owner_id == current_user.id))
    await db.commit()


# ── Change password ───────────────────────────────────────────────────────────

@app.post("/auth/change-password", status_code=200)
async def change_password(
    body: ChangePasswordRequest,
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change password for an authenticated user.

    Checks:
    - current_password must match stored hash
    - new_password min 8 chars, max 72 bytes (bcrypt limit)
    - new_password == confirm_new_password
    - new_password must differ from current password
    """
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
    if body.new_password != body.confirm_new_password:
        raise HTTPException(status_code=400, detail="새 비밀번호와 확인 비밀번호가 일치하지 않습니다.")
    if len(body.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="비밀번호는 72바이트를 초과할 수 없습니다.")
    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="새 비밀번호는 기존 비밀번호와 달라야 합니다.")
    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "비밀번호가 변경되었습니다."}


# ── Forgot / Reset password ───────────────────────────────────────────────────

@app.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> ForgotPasswordResponse:
    """Request a password reset token.

    Always returns a generic success message to prevent email enumeration.

    DEV MODE (ENV != "production"):
      - dev_token and dev_reset_url are included in the response body.
        Copy the token and use it in the Reset Password page.
    PRODUCTION MODE:
      - TODO: send token via email (SMTP/SES/SendGrid — not implemented)
      - Response body never includes the raw token.
    """
    generic_msg = "입력한 이메일 주소로 재설정 링크를 발송했습니다."
    user = await db.scalar(
        select(UserRow).where(UserRow.email == body.email.lower(), UserRow.is_active == True)
    )
    if user is None:
        # Return same response regardless — prevents email enumeration
        return ForgotPasswordResponse(message=generic_msg)

    # Invalidate all pending tokens for this user
    await db.execute(
        sa_update(PasswordResetTokenRow)
        .where(
            PasswordResetTokenRow.user_id == user.id,
            PasswordResetTokenRow.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
    )

    # Generate new token
    raw_token = generate_reset_token()
    token_hash = hash_reset_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    db.add(PasswordResetTokenRow(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    ))
    await db.commit()

    is_production = os.getenv("ENV", "development").lower() == "production"
    if is_production:
        # TODO: send email with reset link (SMTP/SES/SendGrid not implemented)
        return ForgotPasswordResponse(message=generic_msg)
    else:
        # DEV MODE: expose token in response for easy testing
        return ForgotPasswordResponse(
            message=f"[개발 모드] 실제 이메일 발송은 구현되지 않았습니다. 아래 토큰을 사용하세요.",
            dev_token=raw_token,
            dev_reset_url=f"/reset-password?token={raw_token}",
        )


@app.post("/auth/reset-password", status_code=200)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reset password using a valid, unexpired, unused token."""
    if body.new_password != body.confirm_new_password:
        raise HTTPException(status_code=400, detail="새 비밀번호와 확인 비밀번호가 일치하지 않습니다.")
    if len(body.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="비밀번호는 72바이트를 초과할 수 없습니다.")

    token_hash = hash_reset_token(body.token)
    record = await db.scalar(
        select(PasswordResetTokenRow).where(PasswordResetTokenRow.token_hash == token_hash)
    )
    now = datetime.now(timezone.utc)
    if record is None:
        raise HTTPException(status_code=400, detail="유효하지 않은 재설정 토큰입니다.")
    if record.used_at is not None:
        raise HTTPException(status_code=400, detail="이미 사용된 토큰입니다.")
    if record.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="만료된 토큰입니다. 비밀번호 재설정을 다시 요청해주세요.")

    # Update password and mark token as used
    user = await db.get(UserRow, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="계정을 찾을 수 없습니다.")
    user.password_hash = hash_password(body.new_password)
    record.used_at = now
    await db.commit()
    return {"message": "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요."}


# ── Find account ──────────────────────────────────────────────────────────────

@app.post("/auth/find-account", response_model=FindAccountResponse)
async def find_account(
    body: FindAccountRequest,
    db: AsyncSession = Depends(get_db),
) -> FindAccountResponse:
    """Find account by username or email (returns masked info to protect privacy)."""
    not_found_msg = "입력하신 정보와 일치하는 계정을 찾을 수 없습니다."

    if not body.email and not body.username:
        raise HTTPException(status_code=400, detail="이메일 또는 사용자명 중 하나를 입력해주세요.")

    if body.username:
        user = await db.scalar(
            select(UserRow).where(UserRow.username == body.username, UserRow.is_active == True)
        )
        if user is None:
            return FindAccountResponse(message=not_found_msg)
        return FindAccountResponse(
            masked_email=mask_email(user.email),
            message="계정을 찾았습니다.",
        )

    # Find by email
    user = await db.scalar(
        select(UserRow).where(UserRow.email == body.email.lower(), UserRow.is_active == True)
    )
    if user is None:
        return FindAccountResponse(message=not_found_msg)
    return FindAccountResponse(
        username=user.username,
        message="계정을 찾았습니다.",
    )


# ── Update profile ────────────────────────────────────────────────────────────

@app.patch("/auth/me", response_model=UserPublic)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> UserRow:
    """Update the authenticated user's profile.

    Only username can be changed. Email change requires real email verification
    (not implemented — TODO).
    """
    if body.username == current_user.username:
        return current_user  # No-op

    conflict = await db.scalar(
        select(UserRow).where(UserRow.username == body.username, UserRow.id != current_user.id)
    )
    if conflict:
        raise HTTPException(status_code=409, detail="이미 사용 중인 사용자명입니다.")

    current_user.username = body.username
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ── Delete account (soft delete) ──────────────────────────────────────────────

_CONFIRM_TEXTS = {"DELETE", "탈퇴합니다"}

@app.delete("/auth/me", status_code=204)
async def delete_account(
    body: DeleteAccountRequest,
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete the authenticated user's account.

    Protection gates (all must pass):
    1. Password re-confirmation
    2. confirm_text must be "DELETE" or "탈퇴합니다"

    After deletion:
    - is_active = False, deleted_at = now()
    - JWT still exists on client but /auth/me returns 401 (is_active check)
    - Submission history and problem data are preserved (soft delete)
    """
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="비밀번호가 올바르지 않습니다.")
    if body.confirm_text not in _CONFIRM_TEXTS:
        raise HTTPException(
            status_code=400,
            detail='확인 문구로 "DELETE" 또는 "탈퇴합니다"를 정확히 입력해주세요.',
        )

    now = datetime.now(timezone.utc)
    current_user.is_active = False
    current_user.deleted_at = now
    await db.commit()


# ── Problems ──────────────────────────────────────────────────────────────────

@app.get("/problems", response_model=list[Problem])
async def list_problems(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserRow] = Depends(get_current_user_optional),
    problem_type: Optional[str] = None,
):
    if current_user:
        stmt = (
            select(ProblemRow)
            .where(or_(ProblemRow.owner_id.is_(None), ProblemRow.owner_id == current_user.id))
            .order_by(ProblemRow.id)
        )
    else:
        stmt = select(ProblemRow).where(ProblemRow.owner_id.is_(None)).order_by(ProblemRow.id)

    if problem_type:
        stmt = stmt.where(ProblemRow.problem_type == problem_type)

    result = await db.execute(stmt)
    return result.scalars().all()


@app.get("/problems/{problem_id}", response_model=Problem)
async def get_problem(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserRow] = Depends(get_current_user_optional),
):
    row = await db.get(ProblemRow, problem_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    if row.owner_id is not None:
        if current_user is None or row.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Problem not found")
    return row


# ── Submit ────────────────────────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    user_answer: str


class SubmitResponse(BaseModel):
    is_correct: bool
    message: str
    feedback: str | None = None
    correct_answer: str | None = None


@app.post("/problems/{problem_id}/submit", response_model=SubmitResponse)
async def submit_answer(
    problem_id: int,
    body: SubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserRow] = Depends(get_current_user_optional),
    x_ai_provider: Optional[str] = Header(default=None, alias="X-AI-Provider"),
    x_ai_key: Optional[str] = Header(default=None, alias="X-AI-Key"),
):
    """Grade an answer. Auth is optional — guests get graded + feedback but
    nothing is persisted to the DB (the frontend stores guest history in
    localStorage)."""
    row = await db.get(ProblemRow, problem_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    # User-owned problems are only visible to the owner
    if row.owner_id is not None:
        if current_user is None or row.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Problem not found")

    is_ok = grade(body.user_answer, row.answer, quiz_type=row.quiz_type)

    feedback: str | None = None
    if not is_ok and row.problem_type == "command":
        feedback = await generate_feedback(
            problem_title=row.title,
            question=row.question,
            user_answer=body.user_answer,
            category=row.category,
            difficulty=row.difficulty,
            user_provider=x_ai_provider,
            user_api_key=x_ai_key,
        )

    if current_user is not None:
        db.add(
            SubmissionRow(
                problem_id=problem_id,
                user_id=current_user.id,
                user_answer=body.user_answer,
                is_correct=is_ok,
                feedback=feedback,
            )
        )
        await db.commit()

    if is_ok:
        return SubmitResponse(is_correct=True, message="정답입니다!")

    # For quiz problems, reveal the correct answer after wrong submission
    correct_answer = row.answer if row.problem_type == "quiz" else None
    return SubmitResponse(
        is_correct=False,
        message="다시 생각해보세요." if row.problem_type == "command" else "오답입니다.",
        feedback=feedback,
        correct_answer=correct_answer,
    )


# ── Reveal answer (study mode) ───────────────────────────────────────────────


class RevealResponse(BaseModel):
    answer: str
    concept: str
    hint: str


@app.get("/problems/{problem_id}/reveal", response_model=RevealResponse)
async def reveal_answer(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserRow] = Depends(get_current_user_optional),
):
    """Return the canonical answer + concept for study purposes.
    Available to guests too (public seed problems)."""
    row = await db.get(ProblemRow, problem_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    if row.owner_id is not None:
        if current_user is None or row.owner_id != current_user.id:
            raise HTTPException(status_code=404, detail="Problem not found")
    return RevealResponse(answer=row.answer, concept=row.concept, hint=row.hint)


# ── Recommend next problem ───────────────────────────────────────────────────


class RecommendItem(BaseModel):
    id: int
    title: str
    category: str
    difficulty: str
    problem_type: str


@app.get("/problems/{problem_id}/recommend", response_model=list[RecommendItem])
async def recommend_next(
    problem_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserRow] = Depends(get_current_user_optional),
    limit: int = 3,
    exclude: Optional[str] = None,  # comma-separated ids
):
    """Recommend up to `limit` next problems.
    Strategy:
    - Same category as current, same/+1 difficulty
    - Exclude provided ids and the current id
    - Logged-in users get unsolved-first ordering when available."""
    current = await db.get(ProblemRow, problem_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Problem not found")

    excluded_ids: set[int] = {problem_id}
    if exclude:
        for s in exclude.split(","):
            try:
                excluded_ids.add(int(s.strip()))
            except ValueError:
                continue

    # Visible problems (public seeds + own user-generated)
    visibility = or_(ProblemRow.owner_id.is_(None), ProblemRow.owner_id == (current_user.id if current_user else -1))

    # Pull a candidate pool of same category with same problem_type
    stmt = (
        select(ProblemRow)
        .where(
            visibility,
            ProblemRow.category == current.category,
            ProblemRow.problem_type == current.problem_type,
        )
        .order_by(ProblemRow.difficulty, ProblemRow.id)
        .limit(50)
    )
    candidates = (await db.execute(stmt)).scalars().all()

    # Filter excluded
    candidates = [c for c in candidates if c.id not in excluded_ids]

    # If logged in, push unsolved to the front
    if current_user is not None and candidates:
        solved_rows = await db.execute(
            select(SubmissionRow.problem_id)
            .where(
                SubmissionRow.user_id == current_user.id,
                SubmissionRow.is_correct == True,  # noqa: E712
            )
            .distinct()
        )
        solved = {r[0] for r in solved_rows.all()}
        candidates.sort(key=lambda r: (r.id in solved, r.difficulty, r.id))

    picks = candidates[:limit]
    return [
        RecommendItem(
            id=r.id,
            title=r.title,
            category=r.category,
            difficulty=r.difficulty,
            problem_type=r.problem_type,
        )
        for r in picks
    ]


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/stats")
async def get_stats(
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    total_problems = await db.scalar(
        select(func.count()).select_from(ProblemRow).where(
            or_(ProblemRow.owner_id.is_(None), ProblemRow.owner_id == current_user.id)
        )
    ) or 0
    ai_problems = await db.scalar(
        select(func.count()).select_from(ProblemRow).where(
            ProblemRow.ai_generated == True,  # noqa: E712
            ProblemRow.owner_id == current_user.id,
        )
    ) or 0
    total_submissions = await db.scalar(
        select(func.count()).select_from(SubmissionRow).where(
            SubmissionRow.user_id == current_user.id
        )
    ) or 0
    correct_submissions = await db.scalar(
        select(func.count()).select_from(SubmissionRow).where(
            SubmissionRow.user_id == current_user.id,
            SubmissionRow.is_correct == True,  # noqa: E712
        )
    ) or 0
    wrong_submissions = total_submissions - correct_submissions
    accuracy = round(correct_submissions / total_submissions * 100) if total_submissions else 0

    return {
        "total_problems": total_problems,
        "ai_problems": ai_problems,
        "total_submissions": total_submissions,
        "correct_submissions": correct_submissions,
        "wrong_submissions": wrong_submissions,
        "accuracy": accuracy,
    }


# ── Analysis (weakness detection) ────────────────────────────────────────────

@app.get("/analysis", response_model=AnalysisResponse)
async def get_analysis(
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    # All submissions for this user with problem info
    result = await db.execute(
        select(SubmissionRow)
        .where(SubmissionRow.user_id == current_user.id)
        .options(selectinload(SubmissionRow.problem))
        .order_by(SubmissionRow.created_at.desc())
    )
    submissions = result.scalars().all()

    # Per-category aggregation
    cat_total: dict[str, int] = {}
    cat_wrong: dict[str, int] = {}
    solved_ids: set[int] = set()

    for s in submissions:
        if s.problem is None:
            continue
        cat = s.problem.category
        cat_total[cat] = cat_total.get(cat, 0) + 1
        if not s.is_correct:
            cat_wrong[cat] = cat_wrong.get(cat, 0) + 1
        else:
            solved_ids.add(s.problem_id)

    # Build sorted list (worst first, minimum 3 submissions)
    category_stats: list[CategoryStat] = []
    for cat, total in cat_total.items():
        wrong = cat_wrong.get(cat, 0)
        rate = round(wrong / total, 3) if total else 0.0
        category_stats.append(CategoryStat(
            category=cat, total=total, wrong=wrong, wrong_rate=rate
        ))

    category_stats.sort(key=lambda x: (-x.wrong_rate, -x.wrong))
    weak = [c for c in category_stats if c.total >= 3]

    total_sub = len(submissions)
    total_wrong = sum(1 for s in submissions if not s.is_correct)
    overall_rate = round(total_wrong / total_sub, 3) if total_sub else 0.0

    return AnalysisResponse(
        weak_categories=weak[:5],
        total_submissions=total_sub,
        overall_wrong_rate=overall_rate,
        solved_problem_ids=list(solved_ids),
    )


# ── Wrong Notes ───────────────────────────────────────────────────────────────

@app.get("/wrong-notes", response_model=list[WrongNote])
async def list_wrong_notes(
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SubmissionRow)
        .where(
            SubmissionRow.is_correct == False,  # noqa: E712
            SubmissionRow.user_id == current_user.id,
        )
        .order_by(SubmissionRow.created_at.desc())
        .options(selectinload(SubmissionRow.problem))
    )
    rows = result.scalars().all()
    return [
        WrongNote(
            submission_id=r.id,
            problem_id=r.problem_id,
            problem_title=r.problem.title,
            problem_question=r.problem.question,
            category=r.problem.category,
            difficulty=r.problem.difficulty,
            problem_type=r.problem.problem_type,
            user_answer=r.user_answer,
            feedback=r.feedback,
            submitted_at=r.created_at,
        )
        for r in rows
    ]


# ── Generate ──────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    category: Category
    difficulty: Difficulty
    count: int = Field(ge=1, le=10)


class GenerateResponse(BaseModel):
    problems: list[Problem]


@app.post("/generate-problems", response_model=GenerateResponse)
async def generate_problems_endpoint(
    body: GenerateRequest,
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        raw_list = await ai_generate_problems(
            category=body.category,
            difficulty=body.difficulty,
            count=body.count,
        )
    except GeminiQuotaExceededError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"문제 생성 중 오류: {e}")

    created: list[ProblemRow] = []
    is_cloud = cloud_ai_provider() is not None
    for raw in raw_list:
        ans = raw["answer"]
        if isinstance(ans, list):
            ans = json.dumps(ans, ensure_ascii=False)
        elif not isinstance(ans, str):
            ans = str(ans)
        problem_row = ProblemRow(
            title=raw["title"],
            category=body.category,
            difficulty=body.difficulty,
            question=raw["question"],
            answer=ans,
            hint=raw["hint"],
            concept=raw["concept"],
            ai_generated=is_cloud,
            problem_type="command",
            owner_id=current_user.id,
        )
        db.add(problem_row)
        created.append(problem_row)

    await db.flush()
    await db.commit()
    for row in created:
        await db.refresh(row)

    return GenerateResponse(problems=created)


# ── Profile ──────────────────────────────────────────────────────────────────

@app.get("/profile", response_model=ProfileResponse)
async def get_profile(
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    # Submissions for this user, with problem joined for category/concept analysis
    sub_result = await db.execute(
        select(SubmissionRow)
        .where(SubmissionRow.user_id == current_user.id)
        .options(selectinload(SubmissionRow.problem))
        .order_by(SubmissionRow.created_at.desc())
    )
    submissions = sub_result.scalars().all()

    total = len(submissions)
    correct = sum(1 for s in submissions if s.is_correct)
    wrong = total - correct
    accuracy = round(correct / total * 100) if total else 0

    # Created problem count (owner_id == current_user.id)
    created_problem_count = await db.scalar(
        select(func.count()).select_from(ProblemRow).where(
            ProblemRow.owner_id == current_user.id
        )
    ) or 0

    # Weak categories (per-category wrong rate, min 2 attempts)
    cat_total: dict[str, int] = {}
    cat_wrong: dict[str, int] = {}
    concept_wrong: dict[str, int] = {}
    for s in submissions:
        if s.problem is None:
            continue
        c = s.problem.category
        cat_total[c] = cat_total.get(c, 0) + 1
        if not s.is_correct:
            cat_wrong[c] = cat_wrong.get(c, 0) + 1
            concept = (s.problem.concept or "").strip()
            if concept:
                concept_wrong[concept] = concept_wrong.get(concept, 0) + 1

    weak_cats: list[CategoryStat] = []
    for cat, t in cat_total.items():
        w = cat_wrong.get(cat, 0)
        rate = round(w / t, 3) if t else 0.0
        weak_cats.append(CategoryStat(category=cat, total=t, wrong=w, wrong_rate=rate))
    weak_cats.sort(key=lambda x: (-x.wrong_rate, -x.wrong))
    weak_cats = [c for c in weak_cats if c.total >= 2][:3]

    weak_concepts = sorted(
        ({"concept": k, "wrong": v} for k, v in concept_wrong.items()),
        key=lambda x: -x["wrong"],
    )[:5]

    # Recent wrong notes (top 5)
    recent_wrong = []
    for s in submissions:
        if s.is_correct or s.problem is None:
            continue
        recent_wrong.append(WrongNote(
            submission_id=s.id,
            problem_id=s.problem_id,
            problem_title=s.problem.title,
            problem_question=s.problem.question,
            category=s.problem.category,
            difficulty=s.problem.difficulty,
            problem_type=s.problem.problem_type,
            user_answer=s.user_answer,
            feedback=s.feedback,
            submitted_at=s.created_at,
        ))
        if len(recent_wrong) >= 5:
            break

    prov = cloud_ai_provider()
    ai_enabled = prov is not None

    return ProfileResponse(
        user=UserPublic.model_validate(current_user),
        stats={
            "total_submissions": total,
            "correct_count": correct,
            "wrong_count": wrong,
            "accuracy": accuracy,
            "created_problem_count": created_problem_count,
        },
        weak_categories=weak_cats,
        weak_concepts=weak_concepts,
        recent_wrong_notes=recent_wrong,
        ai_mode="AI Mode" if ai_enabled else "Free Rule Mode",
        ai_enabled=ai_enabled,
    )

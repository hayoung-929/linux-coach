import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ai_config import app_mode_label, cloud_ai_provider
from app_errors import GeminiQuotaExceededError
from auth_utils import create_access_token, hash_password, verify_password
from database import AsyncSessionLocal, Base, engine, get_db
from db_models import ProblemRow, SubmissionRow, UserRow
from feedback import generate_feedback
from generate import generate_problems as ai_generate_problems
from grader import is_correct as grade
from models import (
    AnalysisResponse,
    AppConfigResponse,
    Category,
    CategoryStat,
    Difficulty,
    LoginRequest,
    Problem,
    ProfileResponse,
    RegisterRequest,
    TokenResponse,
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
    return await db.get(UserRow, uid)


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

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@app.get("/auth/me", response_model=UserPublic)
async def me(current_user: UserRow = Depends(require_user)):
    return current_user


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
    current_user: UserRow = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(ProblemRow, problem_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    if row.owner_id is not None and row.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Problem not found")

    is_ok = grade(body.user_answer, row.answer, quiz_type=row.quiz_type)

    feedback: str | None = None
    if not is_ok and row.problem_type == "command":
        feedback = await generate_feedback(
            problem_title=row.title,
            question=row.question,
            user_answer=body.user_answer,
            category=row.category,
        )

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

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth_utils import hash_password
from db_models import ProblemRow, UserRow
from mock_data import MOCK_PROBLEMS, QUIZ_PROBLEMS

# ── Demo user (for one-click login) ──────────────────────────────────────────
DEMO_EMAIL = "demo@linuxcoach.local"
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo1234"


def _prepare_row(data: dict) -> dict:
    row_data = dict(data)
    answer = row_data["answer"]
    if isinstance(answer, list):
        row_data["answer"] = json.dumps(answer, ensure_ascii=False)
    choices = row_data.get("choices")
    if isinstance(choices, list):
        row_data["choices"] = json.dumps(choices, ensure_ascii=False)
    return row_data


ALL_SEED_PROBLEMS = MOCK_PROBLEMS + QUIZ_PROBLEMS


async def seed_if_empty(db: AsyncSession) -> None:
    result = await db.execute(select(ProblemRow).limit(1))
    if result.scalar_one_or_none() is not None:
        return

    for data in ALL_SEED_PROBLEMS:
        db.add(ProblemRow(**_prepare_row(data), ai_generated=False))

    await db.commit()


async def seed_demo_user_if_missing(db: AsyncSession) -> None:
    """Create a demo account so users can log in without registering.

    Idempotent: skips creation if already present.
    Also upgrades existing demo users that have is_demo=False (migration safety).
    """
    existing = await db.scalar(select(UserRow).where(UserRow.email == DEMO_EMAIL))
    if existing is not None:
        # Backfill is_demo flag in case this is an older row created before the column existed
        if not existing.is_demo:
            existing.is_demo = True
            await db.commit()
        return
    db.add(UserRow(
        email=DEMO_EMAIL,
        username=DEMO_USERNAME,
        password_hash=hash_password(DEMO_PASSWORD),
        is_demo=True,
    ))
    await db.commit()


async def merge_new_seed_problems(db: AsyncSession) -> None:
    """Insert any built-in problems not yet in the DB (idempotent by title+category+difficulty)."""
    result = await db.execute(select(ProblemRow))
    existing = {
        (r.title, r.category, r.difficulty) for r in result.scalars().all()
    }
    added = False
    for data in ALL_SEED_PROBLEMS:
        key = (data["title"], data["category"], data["difficulty"])
        if key in existing:
            continue
        db.add(ProblemRow(**_prepare_row(data), ai_generated=False))
        existing.add(key)
        added = True
    if added:
        await db.commit()

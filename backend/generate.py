"""Top-level problem generation dispatcher with full fallback chain.

Priority:
  1. Cloud AI (OpenAI or Gemini) — when API key is configured
  2. Built-in variable-substitution template pool (free mode)
  3. Absolute hardcoded minimum (should never be reached in practice)

Returns a tuple: (problems: list[dict], source: str)
  source = "ai"       — Cloud AI was used successfully
  source = "template" — Template pool (or hardcoded) was used

GeminiQuotaExceededError is intentionally re-raised so the endpoint can
return HTTP 503 and ask the user to retry later.  All other AI failures
are silently caught and fall through to the template tier so the user
always gets at least one problem.
"""

from __future__ import annotations

import copy
import logging
import random
import uuid

from app_errors import GeminiQuotaExceededError
from ai_config import cloud_ai_provider
from generate_gemini import generate_gemini_problems
from generate_openai import generate_openai_problems
from template_generate import generate_from_templates, _HARDCODED

logger = logging.getLogger(__name__)


async def generate_problems(
    category: str, difficulty: str, count: int
) -> tuple[list[dict], str]:
    """Generate *count* problems, returning (problems, source).

    source is "ai" when Cloud AI was used, "template" otherwise.
    """
    provider = cloud_ai_provider()

    # ── Tier 1: Cloud AI ──────────────────────────────────────────────────────
    if provider == "openai":
        try:
            result = await generate_openai_problems(category, difficulty, count)
            if result:
                logger.info("[generate] OpenAI succeeded: %d problems", len(result))
                return result, "ai"
            logger.warning("[generate] OpenAI returned empty list; falling back to templates")
        except GeminiQuotaExceededError:
            raise  # surface quota errors directly to the endpoint
        except Exception as exc:
            logger.warning("[generate] OpenAI failed (%s); falling back to templates", exc)

    elif provider == "gemini":
        try:
            result = await generate_gemini_problems(category, difficulty, count)
            if result:
                logger.info("[generate] Gemini succeeded: %d problems", len(result))
                return result, "ai"
            logger.warning("[generate] Gemini returned empty list; falling back to templates")
        except GeminiQuotaExceededError:
            raise  # surface quota errors directly to the endpoint
        except Exception as exc:
            logger.warning("[generate] Gemini failed (%s); falling back to templates", exc)

    # ── Tier 2: Built-in template pool ────────────────────────────────────────
    try:
        result = generate_from_templates(category, difficulty, count)
        if result:
            logger.info("[generate] Template pool succeeded: %d problems", len(result))
            return result, "template"
        logger.warning("[generate] Template pool returned empty; using hardcoded fallback")
    except Exception as exc:
        logger.warning("[generate] Template pool failed (%s); using hardcoded fallback", exc)

    # ── Tier 3: Absolute hardcoded minimum (cannot fail) ─────────────────────
    logger.warning("[generate] Using hardcoded absolute minimum fallback")
    pool = list(_HARDCODED)
    picks = (
        random.choices(pool, k=count)
        if count > len(pool)
        else random.sample(pool, k=count)
    )
    out = []
    for p in picks:
        row = copy.deepcopy(p)
        row["category"] = category
        row["difficulty"] = difficulty
        row["title"] = f"{p['title']} · 연습 {uuid.uuid4().hex[:6]}"
        out.append(row)
    return out, "template"

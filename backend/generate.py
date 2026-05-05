"""Top-level problem generation dispatcher with full fallback chain.

Priority:
  1. Cloud AI (OpenAI or Gemini) — when API key is configured
  2. Built-in template pool (free mode)
  3. Absolute hardcoded minimum (should never be reached in practice)

GeminiQuotaExceededError is intentionally re-raised so the endpoint can
return HTTP 503 and ask the user to retry later.  All other AI failures
(network, parse, field-validation) are silently caught and fall through to
the template tier so the user always gets at least one problem.
"""

from __future__ import annotations

import logging

from app_errors import GeminiQuotaExceededError
from ai_config import cloud_ai_provider
from generate_gemini import generate_gemini_problems
from generate_openai import generate_openai_problems
from template_generate import generate_from_templates

logger = logging.getLogger(__name__)


async def generate_problems(category: str, difficulty: str, count: int) -> list[dict]:
    provider = cloud_ai_provider()

    # ── Tier 1: Cloud AI ──────────────────────────────────────────────────────
    if provider == "openai":
        try:
            result = await generate_openai_problems(category, difficulty, count)
            if result:
                return result
            logger.warning("OpenAI returned empty list; falling back to templates")
        except GeminiQuotaExceededError:
            raise  # surface quota errors directly to the endpoint
        except Exception as exc:
            logger.warning("OpenAI generation failed (%s); falling back to templates", exc)

    elif provider == "gemini":
        try:
            result = await generate_gemini_problems(category, difficulty, count)
            if result:
                return result
            logger.warning("Gemini returned empty list; falling back to templates")
        except GeminiQuotaExceededError:
            raise  # surface quota errors directly to the endpoint
        except Exception as exc:
            logger.warning("Gemini generation failed (%s); falling back to templates", exc)

    # ── Tier 2: Built-in template pool ────────────────────────────────────────
    try:
        result = generate_from_templates(category, difficulty, count)
        if result:
            return result
        logger.warning("Template generation returned empty list; using hardcoded fallback")
    except Exception as exc:
        logger.warning("Template generation failed (%s); using hardcoded fallback", exc)

    # ── Tier 3: Absolute hardcoded minimum (cannot fail) ─────────────────────
    from template_generate import _HARDCODED
    import copy, random, uuid

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
    return out

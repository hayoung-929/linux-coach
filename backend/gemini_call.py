"""Shared Gemini generate_content with 429 backoff."""

import asyncio

from google.genai import errors as genai_errors

from app_errors import GeminiQuotaExceededError

# 문제 JSON 생성은 출력 상한이 크면 무료 티어 토큰 한도에 빨리 걸리기 쉬움
DEFAULT_MAX_OUTPUT_TOKENS_GENERATE = 4096


def _is_rate_limited(exc: genai_errors.APIError) -> bool:
    if exc.code == 429:
        return True
    status = (exc.status or "").upper()
    return status in ("RESOURCE_EXHAUSTED", "UNAVAILABLE")


async def aio_generate_content(client, *, model: str, contents, config, retries: int = 4):
    """Call client.aio.models.generate_content; retry on 429 with exponential backoff."""
    delay = 3.0
    for attempt in range(retries):
        try:
            return await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
        except genai_errors.APIError as e:
            if _is_rate_limited(e) and attempt < retries - 1:
                await asyncio.sleep(delay)
                delay = min(delay * 2.0, 45.0)
                continue
            if _is_rate_limited(e):
                raise GeminiQuotaExceededError(
                    "Gemini 요청 한도(분당·일일 또는 토큰)에 걸렸습니다. "
                    "1~2분 뒤에 다시 시도하거나 .env의 GEMINI_MODEL을 다른 모델로 바꿔 보세요."
                ) from e
            raise

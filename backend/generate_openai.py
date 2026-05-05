"""OpenAI-based problem generation."""

from __future__ import annotations

import json
import logging
import os
import re

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
너는 리눅스 교육 문제 출제자다.
반드시 JSON 배열 형식으로만 응답해라.
마크다운 코드 블록, 설명, 주석 없이 순수 JSON 배열만 출력해라."""

_openai_client: AsyncOpenAI | None = None


def _get_openai() -> AsyncOpenAI:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=key)
    return _openai_client


def _extract_json_array(text: str) -> str:
    """Strip markdown fences and extract the outermost JSON array."""
    text = re.sub(r"```(?:json)?", "", text)
    text = text.replace("```", "").strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("응답에서 JSON 배열을 찾을 수 없습니다.")
    return text[start : end + 1]


def _normalise_item(item: object, category: str, difficulty: str) -> dict | None:
    """Convert a raw AI response element to a validated problem dict.

    Returns *None* when the item is so malformed that no useful problem can
    be constructed.  Missing optional fields are filled with sensible defaults.
    """
    if not isinstance(item, dict):
        return None

    question = (
        item.get("question")
        or item.get("problem")
        or item.get("content")
        or ""
    )
    answer = (
        item.get("answer")
        or item.get("cmd")
        or item.get("command")
        or ""
    )

    if not str(question).strip() or not str(answer).strip():
        logger.debug("Dropping item with empty question/answer: %s", item)
        return None

    return {
        "title":    str(item.get("title") or f"{category} 명령어 문제"),
        "category": category,
        "difficulty": difficulty,
        "question": str(question),
        "answer":   str(answer),
        "hint":     str(item.get("hint") or "관련 man 페이지를 참고하세요."),
        "concept":  str(item.get("concept") or item.get("explanation") or ""),
    }


async def generate_openai_problems(category: str, difficulty: str, count: int) -> list[dict]:
    client = _get_openai()

    user_message = (
        f"다음 조건에 맞는 리눅스 명령어 문제 {count}개를 JSON 배열로 생성해라.\n\n"
        f"카테고리: {category}\n"
        f"난이도: {difficulty}\n\n"
        "각 문제 JSON 형식:\n"
        "{\n"
        '  "title": "문제 제목 (한국어, 간결하게)",\n'
        f'  "category": "{category}",\n'
        f'  "difficulty": "{difficulty}",\n'
        '  "question": "문제 내용 (한국어, 구체적인 조건 명시)",\n'
        '  "answer": "정확한 리눅스 명령어 (실행 가능한 형태)",\n'
        '  "hint": "풀이 방향 힌트 (정답 명령어를 직접 포함하지 말 것)",\n'
        '  "concept": "이 문제의 핵심 개념 한 문장"\n'
        "}\n\n"
        f"위 형식의 JSON 객체 {count}개를 담은 배열만 반환해라."
    )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4096,
        temperature=0.8,
    )

    raw = (response.choices[0].message.content or "").strip()
    if not raw:
        raise ValueError("OpenAI가 빈 응답을 반환했습니다.")

    # Parse JSON — try direct parse first, then strip markdown fences
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            data = json.loads(_extract_json_array(raw))
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"OpenAI 응답 JSON 파싱 실패: {exc}\n응답 미리보기: {raw[:300]}") from exc

    # Accept a single dict wrapped in a list
    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list):
        raise ValueError(f"OpenAI 응답이 배열이 아닙니다 (type={type(data).__name__})")

    # Normalise each item; drop items that are completely unusable
    problems = [_normalise_item(item, category, difficulty) for item in data]
    problems = [p for p in problems if p is not None]

    if not problems:
        raise ValueError("OpenAI 응답에서 유효한 문제를 하나도 추출하지 못했습니다.")

    logger.info("OpenAI generated %d/%d problems", len(problems), count)
    return problems

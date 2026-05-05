"""Gemini-based problem generation."""

from __future__ import annotations

import json
import logging
import re

from google.genai import types

from gemini_call import DEFAULT_MAX_OUTPUT_TOKENS_GENERATE, aio_generate_content
from llm_client import gemini_model, get_gemini_client

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
너는 리눅스 교육 문제 출제자다.
반드시 JSON 배열 형식으로만 응답해라.
마크다운 코드 블록, 설명, 주석 없이 순수 JSON 배열만 출력해라."""


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
    be constructed (e.g. not a dict, or both question and answer are empty).
    Missing optional fields are filled with sensible defaults so that a
    partially-formed AI response is still usable.
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

    # Both question and answer must be non-empty to be useful
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


async def generate_gemini_problems(category: str, difficulty: str, count: int) -> list[dict]:
    client = get_gemini_client()
    if client is None:
        raise ValueError("GEMINI_API_KEY 또는 GOOGLE_API_KEY가 설정되지 않았습니다.")

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

    response = await aio_generate_content(
        client,
        model=gemini_model(),
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            max_output_tokens=DEFAULT_MAX_OUTPUT_TOKENS_GENERATE,
            temperature=0.8,
            response_mime_type="application/json",
        ),
    )

    raw = (response.text or "").strip()
    if not raw:
        raise ValueError("Gemini가 빈 응답을 반환했습니다.")

    # Parse JSON — try direct parse first, then strip markdown fences
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            data = json.loads(_extract_json_array(raw))
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"Gemini 응답 JSON 파싱 실패: {exc}\n응답 미리보기: {raw[:300]}") from exc

    # Accept a single dict wrapped in a list
    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list):
        raise ValueError(f"Gemini 응답이 배열이 아닙니다 (type={type(data).__name__})")

    # Normalise each item; drop items that are completely unusable
    problems = [_normalise_item(item, category, difficulty) for item in data]
    problems = [p for p in problems if p is not None]

    if not problems:
        raise ValueError("Gemini 응답에서 유효한 문제를 하나도 추출하지 못했습니다.")

    logger.info("Gemini generated %d/%d problems", len(problems), count)
    return problems

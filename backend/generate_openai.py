import json
import os
import re

from openai import AsyncOpenAI

_SYSTEM_PROMPT = """\
너는 리눅스 교육 문제 출제자다.
반드시 JSON 배열 형식으로만 응답해라.
마크다운 코드 블록, 설명, 주석 없이 순수 JSON 배열만 출력해라."""


def extract_json_array(text: str) -> str:
    text = re.sub(r"```(?:json)?", "", text)
    text = text.replace("```", "").strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("응답에서 JSON 배열을 찾을 수 없습니다.")
    return text[start : end + 1]


_REQUIRED_FIELDS = {"title", "category", "difficulty", "question", "answer", "hint", "concept"}

_openai_client: AsyncOpenAI | None = None


def _get_openai() -> AsyncOpenAI:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=key)
    return _openai_client


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
        raise ValueError("모델이 빈 응답을 반환했습니다.")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        cleaned = extract_json_array(raw)
        data = json.loads(cleaned)

    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("응답이 빈 배열이거나 배열 형식이 아닙니다.")

    for item in data:
        if not isinstance(item, dict):
            raise ValueError(f"배열 원소가 객체가 아닙니다: {item}")
        missing = _REQUIRED_FIELDS - item.keys()
        if missing:
            raise ValueError(f"필수 필드 누락: {missing}")

    return data

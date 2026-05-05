import os

from openai import AsyncOpenAI

_FALLBACK = "다시 생각해보세요. 힌트를 참고하면 도움이 될 수 있습니다."

_SYSTEM_PROMPT = """\
너는 친절한 리눅스 코치다.
사용자가 리눅스 명령어 문제를 틀렸을 때, 정답을 절대 직접 알려주지 마라.
사용자가 스스로 답을 찾을 수 있도록 질문형 피드백을 1~2개 제공해라.
초보자도 이해할 수 있는 쉬운 표현을 사용해라.
2~4문장 이내로 답해라."""

_openai_client: AsyncOpenAI | None = None


def _get_openai() -> AsyncOpenAI | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=key)
    return _openai_client


async def generate_openai_feedback(
    problem_title: str,
    question: str,
    user_answer: str,
    api_key: str | None = None,
) -> str:
    if api_key:
        client = AsyncOpenAI(api_key=api_key)
    else:
        client = _get_openai()
    if client is None:
        return _FALLBACK

    user_message = (
        f"문제: {problem_title}\n"
        f"문제 내용: {question}\n"
        f"사용자가 제출한 오답: {user_answer}\n\n"
        "이 답안이 왜 틀렸는지 정답을 알려주지 말고, "
        "사용자 스스로 생각할 수 있도록 질문형 피드백만 제공해 주세요."
    )

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=200,
            temperature=0.7,
        )
        text = (response.choices[0].message.content or "").strip()
        return text if text else _FALLBACK
    except Exception:
        return _FALLBACK

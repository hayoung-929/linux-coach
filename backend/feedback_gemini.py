from google.genai import types

from gemini_call import aio_generate_content
from llm_client import gemini_model, get_gemini_client

_FALLBACK = "다시 생각해보세요. 힌트를 참고하면 도움이 될 수 있습니다."

_SYSTEM_PROMPT = """\
너는 친절한 리눅스 코치다.
사용자가 리눅스 명령어 문제를 틀렸을 때, 정답을 절대 직접 알려주지 마라.
사용자가 스스로 답을 찾을 수 있도록 질문형 피드백을 1~2개 제공해라.
초보자도 이해할 수 있는 쉬운 표현을 사용해라.
2~4문장 이내로 답해라."""


async def generate_gemini_feedback(
    problem_title: str,
    question: str,
    user_answer: str,
) -> str:
    client = get_gemini_client()
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
        response = await aio_generate_content(
            client,
            model=gemini_model(),
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                max_output_tokens=200,
                temperature=0.7,
            ),
            retries=3,
        )
        text = (response.text or "").strip()
        return text if text else _FALLBACK
    except Exception:
        return _FALLBACK

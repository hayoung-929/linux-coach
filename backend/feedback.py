from ai_config import cloud_ai_provider
from feedback_gemini import generate_gemini_feedback
from feedback_openai import generate_openai_feedback
from rule_feedback import generate_rule_feedback


async def generate_feedback(
    problem_title: str,
    question: str,
    user_answer: str,
    category: str,
    difficulty: str = "easy",
    user_provider: str | None = None,
    user_api_key: str | None = None,
) -> str:
    """Resolve coach feedback in priority order:

    1. User-supplied API key (User AI Mode) — overrides server keys.
    2. Server API keys (Admin AI Mode).
    3. Rule-based question-style coach (Free Rule Mode).
    """
    if user_api_key:
        try:
            if user_provider == "openai":
                return await generate_openai_feedback(problem_title, question, user_answer, api_key=user_api_key)
            if user_provider == "gemini":
                return await generate_gemini_feedback(problem_title, question, user_answer, api_key=user_api_key)
        except Exception:
            # Any failure → quietly fall back to rule-based coach
            pass

    provider = cloud_ai_provider()
    if provider == "openai":
        try:
            return await generate_openai_feedback(problem_title, question, user_answer)
        except Exception:
            pass
    if provider == "gemini":
        try:
            return await generate_gemini_feedback(problem_title, question, user_answer)
        except Exception:
            pass

    return generate_rule_feedback(category, problem_title, question, user_answer, difficulty)

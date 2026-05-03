from ai_config import cloud_ai_provider
from feedback_gemini import generate_gemini_feedback
from feedback_openai import generate_openai_feedback
from rule_feedback import generate_rule_feedback


async def generate_feedback(
    problem_title: str,
    question: str,
    user_answer: str,
    category: str,
) -> str:
    provider = cloud_ai_provider()
    if provider == "openai":
        return await generate_openai_feedback(problem_title, question, user_answer)
    if provider == "gemini":
        return await generate_gemini_feedback(problem_title, question, user_answer)
    return generate_rule_feedback(category, problem_title, question, user_answer)

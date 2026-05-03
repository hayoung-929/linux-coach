from ai_config import cloud_ai_provider
from generate_gemini import generate_gemini_problems
from generate_openai import generate_openai_problems
from template_generate import generate_from_templates


async def generate_problems(category: str, difficulty: str, count: int) -> list[dict]:
    provider = cloud_ai_provider()
    if provider == "openai":
        return await generate_openai_problems(category, difficulty, count)
    if provider == "gemini":
        return await generate_gemini_problems(category, difficulty, count)
    return generate_from_templates(category, difficulty, count)

class GeminiQuotaExceededError(Exception):
    """Gemini 429 / RESOURCE_EXHAUSTED after retries."""

"""Cloud AI provider selection: OpenAI > Gemini > none (free rule + template mode)."""

import os
from typing import Literal

CloudProvider = Literal["openai", "gemini"]


def openai_api_key() -> str:
    return os.getenv("OPENAI_API_KEY", "").strip()


def gemini_api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()


def cloud_ai_provider() -> CloudProvider | None:
    """Returns active cloud provider, or None for fully offline free mode."""
    if openai_api_key():
        return "openai"
    if gemini_api_key():
        return "gemini"
    return None


def is_cloud_ai_enabled() -> bool:
    return cloud_ai_provider() is not None


def app_mode_label() -> tuple[str, str]:
    """(mode_id, display_label) for UI."""
    if cloud_ai_provider() == "openai":
        return ("ai", "AI Mode (OpenAI)")
    if cloud_ai_provider() == "gemini":
        return ("ai", "AI Mode (Gemini)")
    return ("free", "Free Rule Mode")

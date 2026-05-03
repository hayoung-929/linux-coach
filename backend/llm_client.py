"""Lazy Gemini (Google Gen AI) client for feedback and problem generation."""

import os

from google import genai

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client | None:
    key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not key:
        return None
    global _client
    if _client is None:
        _client = genai.Client(api_key=key)
    return _client


def gemini_model() -> str:
    return (os.getenv("GEMINI_MODEL") or "gemini-2.0-flash").strip()

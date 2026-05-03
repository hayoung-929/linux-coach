import json
import re


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def is_correct(user_answer: str, stored_answer: str, quiz_type: str | None = None) -> bool:
    """
    Grades a submitted answer.

    For command/fill problems:
      stored_answer can be a plain string or JSON array of valid answers.
      Comparison is case-insensitive and whitespace-normalised.

    For OX problems:
      user_answer must be "O" or "X" (case-insensitive).

    For MC problems:
      Exact text match (case-insensitive) against stored_answer.
    """
    if quiz_type == "ox":
        return user_answer.strip().upper() == stored_answer.strip().upper()

    if quiz_type == "mc":
        return _normalize(user_answer) == _normalize(stored_answer)

    # command / fill
    normalized_user = _normalize(user_answer)
    try:
        parsed = json.loads(stored_answer)
        candidates: list[str] = parsed if isinstance(parsed, list) else [str(parsed)]
    except (json.JSONDecodeError, ValueError):
        candidates = [stored_answer]

    return any(_normalize(c) == normalized_user for c in candidates)

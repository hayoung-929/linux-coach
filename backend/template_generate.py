"""Pick random problems from built-in MOCK pool (free mode, no cloud API)."""

from __future__ import annotations

import copy
import random
import uuid

from mock_data import MOCK_PROBLEMS


def generate_from_templates(category: str, difficulty: str, count: int) -> list[dict]:
    pool = [
        p
        for p in MOCK_PROBLEMS
        if p["category"] == category and p["difficulty"] == difficulty
    ]
    if not pool:
        raise ValueError(
            f"내장 문제 풀에 해당 조합이 없습니다: category={category}, difficulty={difficulty}"
        )
    picks = random.choices(pool, k=count) if count > len(pool) else random.sample(pool, k=count)
    out: list[dict] = []
    for p in picks:
        row = copy.deepcopy(p)
        suffix = uuid.uuid4().hex[:6]
        row["title"] = f"{p['title']} · 연습 {suffix}"
        out.append(row)
    return out

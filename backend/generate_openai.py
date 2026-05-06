"""OpenAI-based problem generation."""

from __future__ import annotations

import json
import logging
import os
import re

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
너는 리눅스 교육 문제 출제 전문가다.
반드시 JSON 배열 형식으로만 응답해라.
마크다운 코드 블록, 설명, 주석 없이 순수 JSON 배열만 출력해라."""

_DIFFICULTY_GUIDE = {
    "beginner": "리눅스를 처음 접하는 입문자 수준. ls, cd, pwd, cat, cp, mv 등 가장 기본적인 명령어만 사용.",
    "easy": "기본 명령어 옵션 활용. ls -la, chmod, grep 기본 사용, 파이프 1개 이하.",
    "medium": "명령어 조합과 옵션 활용. 파이프 2개 이하, find, awk, sed 기본, 리다이렉션 포함 가능.",
    "hard": "복잡한 명령어 조합. 정규식, 다단계 파이프라인, 스크립트 수준의 한 줄 명령어.",
}

_CATEGORY_GUIDE = {
    "file": "파일 생성·조회·복사·이동·삭제·내용 확인 (ls, cat, cp, mv, rm, touch, head, tail, wc, stat)",
    "directory": "디렉터리 탐색·생성·복사·삭제·크기 확인 (pwd, cd, mkdir, rmdir, rm -r, du, find)",
    "permission": "파일 권한·소유자 관리 (chmod, chown, chgrp, umask, ACL, SUID/SGID)",
    "process": "프로세스 확인·제어·모니터링 (ps, top, htop, kill, pkill, pgrep, nice, nohup)",
    "network": "네트워크 상태·연결·진단 (ip, ss, ping, traceroute, netstat, curl, wget, dig, nmap)",
    "package": "패키지 설치·제거·조회 (apt, dpkg, apt-cache, apt-get)",
    "service": "서비스 관리·모니터링 (systemctl, journalctl, service)",
    "search": "파일·내용 검색 (grep, find, locate, awk, sed)",
    "compression": "파일 압축·해제 (tar, gzip, bzip2, zip, unzip, xz)",
    "environment": "환경변수·쉘 설정 (export, echo, env, unset, source, alias, PATH)",
}

_openai_client: AsyncOpenAI | None = None


def _get_openai() -> AsyncOpenAI:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=key)
    return _openai_client


def _build_user_prompt(category: str, difficulty: str, count: int) -> str:
    diff_guide = _DIFFICULTY_GUIDE.get(difficulty, _DIFFICULTY_GUIDE["easy"])
    cat_guide = _CATEGORY_GUIDE.get(category, category)

    return f"""\
리눅스 실무 상황 기반 문제 {count}개를 생성해라.

[카테고리] {category} — {cat_guide}
[난이도]   {difficulty} — {diff_guide}

[출력 형식] 아래 JSON 객체 {count}개를 담은 배열만 반환:
{{
  "title": "짧은 문제 제목 (15자 이내, 한국어)",
  "question": "실무 시나리오가 담긴 문제 (한국어, 2~4문장). 구체적인 파일명·서비스명·포트 번호 등을 포함하라.",
  "answer": "정확히 실행 가능한 리눅스 명령어 한 줄",
  "hint": "풀이 방향을 안내하되 정답 명령어를 직접 포함하지 말 것 (한국어)",
  "concept": "이 명령어의 핵심 개념 한 문장 (한국어)"
}}

[좋은 문제 예시]
question: "웹 서버 배포 후 /var/log/nginx/access.log 파일의 마지막 100줄을 실시간으로 모니터링해야 한다. 적합한 명령어를 작성하라."
answer: "tail -f -n 100 /var/log/nginx/access.log"

[나쁜 문제 예시 — 이렇게 하지 마라]
question: "tail 명령어를 사용하라." (너무 추상적)
question: "파일을 확인하는 명령어를 써라." (파일명·목적 없음)

규칙:
- 각 문제는 서로 다른 명령어 또는 다른 옵션 조합을 사용해야 한다
- 동일한 명령어가 {min(2, count)}개 이상 중복되면 안 된다
- 배열 외 다른 텍스트를 출력하지 마라
"""


def _extract_json_array(text: str) -> str:
    """Strip markdown fences and extract the outermost JSON array."""
    text = re.sub(r"```(?:json)?", "", text)
    text = text.replace("```", "").strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("응답에서 JSON 배열을 찾을 수 없습니다.")
    return text[start : end + 1]


def _normalise_item(item: object, category: str, difficulty: str) -> dict | None:
    """Convert a raw AI response element to a validated problem dict.

    Returns *None* when the item is so malformed that no useful problem can
    be constructed.  Missing optional fields are filled with sensible defaults.
    """
    if not isinstance(item, dict):
        return None

    question = (
        item.get("question")
        or item.get("problem")
        or item.get("content")
        or ""
    )
    answer = (
        item.get("answer")
        or item.get("cmd")
        or item.get("command")
        or ""
    )

    if not str(question).strip() or not str(answer).strip():
        logger.debug("Dropping item with empty question/answer: %s", item)
        return None

    return {
        "title":    str(item.get("title") or f"{category} 명령어 문제"),
        "category": category,
        "difficulty": difficulty,
        "question": str(question),
        "answer":   str(answer),
        "hint":     str(item.get("hint") or "관련 man 페이지를 참고하세요."),
        "concept":  str(item.get("concept") or item.get("explanation") or ""),
    }


async def generate_openai_problems(category: str, difficulty: str, count: int) -> list[dict]:
    client = _get_openai()

    user_message = _build_user_prompt(category, difficulty, count)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4096,
        temperature=0.85,
        response_format={"type": "json_object"},
    )

    raw = (response.choices[0].message.content or "").strip()
    if not raw:
        raise ValueError("OpenAI가 빈 응답을 반환했습니다.")

    # Parse JSON — response_format json_object may wrap the array
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        try:
            data = json.loads(_extract_json_array(raw))
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"OpenAI 응답 JSON 파싱 실패: {exc}\n응답 미리보기: {raw[:300]}") from exc

    # Unwrap if the model returned {"problems": [...]} or similar wrapper
    if isinstance(data, dict):
        for key in ("problems", "questions", "items", "data", "results"):
            if key in data and isinstance(data[key], list):
                data = data[key]
                break
        else:
            data = [data]  # single problem dict

    if not isinstance(data, list):
        raise ValueError(f"OpenAI 응답이 배열이 아닙니다 (type={type(data).__name__})")

    # Normalise each item; drop items that are completely unusable
    problems = [_normalise_item(item, category, difficulty) for item in data]
    problems = [p for p in problems if p is not None]

    if not problems:
        raise ValueError("OpenAI 응답에서 유효한 문제를 하나도 추출하지 못했습니다.")

    logger.info("OpenAI generated %d/%d problems", len(problems), count)
    return problems

"""Pick problems from built-in MOCK pool with graceful multi-level fallback (free mode)."""

from __future__ import annotations

import copy
import random
import uuid

from mock_data import MOCK_PROBLEMS

# ── Hardcoded absolute-minimum fallback ───────────────────────────────────────
# Used only when the MOCK pool is completely empty (should never happen in
# production, but guarantees the endpoint always returns ≥1 problem).

_HARDCODED: list[dict] = [
    {
        "title": "숨김 파일 포함 목록 확인",
        "category": "file",
        "difficulty": "easy",
        "question": "현재 디렉터리의 모든 파일(숨김 파일 포함)을 상세 목록으로 출력하는 명령어를 작성하라.",
        "answer": "ls -la",
        "hint": "ls 명령어의 -a(all)와 -l(long) 옵션을 조합하세요.",
        "concept": "ls -a는 .으로 시작하는 숨김 파일까지 포함하여 출력한다.",
    },
    {
        "title": "파일 복사",
        "category": "file",
        "difficulty": "easy",
        "question": "foo.txt 파일을 bar.txt라는 이름으로 복사하는 명령어를 작성하라.",
        "answer": "cp foo.txt bar.txt",
        "hint": "cp 명령어는 '원본 대상' 순서로 인수를 받습니다.",
        "concept": "cp(copy) 명령어로 파일을 복사한다.",
    },
    {
        "title": "파일 삭제",
        "category": "file",
        "difficulty": "easy",
        "question": "temp.txt 파일을 삭제하는 명령어를 작성하라.",
        "answer": "rm temp.txt",
        "hint": "rm(remove) 명령어를 사용합니다.",
        "concept": "rm 명령어는 파일을 삭제한다. 복구가 불가능하므로 주의해야 한다.",
    },
    {
        "title": "현재 위치 확인",
        "category": "directory",
        "difficulty": "easy",
        "question": "현재 작업 디렉터리의 절대 경로를 출력하는 명령어를 작성하라.",
        "answer": "pwd",
        "hint": "Print Working Directory의 약자입니다.",
        "concept": "pwd 명령어는 현재 작업 디렉터리의 절대 경로를 출력한다.",
    },
    {
        "title": "파일 권한 확인",
        "category": "permission",
        "difficulty": "easy",
        "question": "/etc/passwd 파일의 권한을 상세히 확인하는 명령어를 작성하라.",
        "answer": "ls -l /etc/passwd",
        "hint": "ls 명령어의 -l 옵션으로 권한을 확인할 수 있습니다.",
        "concept": "ls -l은 파일의 권한, 소유자, 크기, 수정 시각을 포함한 상세 정보를 출력한다.",
    },
    {
        "title": "실행 중인 프로세스 확인",
        "category": "process",
        "difficulty": "easy",
        "question": "현재 실행 중인 모든 프로세스를 확인하는 명령어를 작성하라.",
        "answer": "ps aux",
        "hint": "ps 명령어에 all user 옵션을 함께 사용하세요.",
        "concept": "ps aux는 시스템의 모든 사용자 프로세스를 상세히 출력한다.",
    },
    {
        "title": "네트워크 인터페이스 확인",
        "category": "network",
        "difficulty": "easy",
        "question": "현재 시스템의 네트워크 인터페이스 목록과 IP 주소를 확인하는 명령어를 작성하라.",
        "answer": "ip addr",
        "hint": "ip 명령어의 addr 서브커맨드를 사용하세요.",
        "concept": "ip addr 명령어는 네트워크 인터페이스의 IP 주소를 출력한다.",
    },
    {
        "title": "패키지 설치",
        "category": "package",
        "difficulty": "easy",
        "question": "apt 패키지 관리자로 curl 패키지를 설치하는 명령어를 작성하라.",
        "answer": "apt install curl",
        "hint": "apt 명령어의 install 서브커맨드를 사용하세요.",
        "concept": "apt install은 데비안/우분투 계열에서 패키지를 설치하는 명령어이다.",
    },
    {
        "title": "서비스 상태 확인",
        "category": "service",
        "difficulty": "easy",
        "question": "nginx 서비스의 현재 상태를 확인하는 명령어를 작성하라.",
        "answer": "systemctl status nginx",
        "hint": "systemctl 명령어의 status 서브커맨드를 사용하세요.",
        "concept": "systemctl status는 systemd 서비스의 현재 상태(실행 중, 중지 등)를 출력한다.",
    },
    {
        "title": "파일 내 문자열 검색",
        "category": "search",
        "difficulty": "easy",
        "question": "/etc/passwd 파일에서 'root'가 포함된 줄을 출력하는 명령어를 작성하라.",
        "answer": "grep 'root' /etc/passwd",
        "hint": "grep 명령어는 파일에서 패턴을 검색합니다.",
        "concept": "grep은 파일에서 지정한 문자열 패턴과 일치하는 줄을 출력하는 도구이다.",
    },
    {
        "title": "tar 압축 풀기",
        "category": "compression",
        "difficulty": "easy",
        "question": "backup.tar.gz 파일을 현재 디렉터리에 압축 해제하는 명령어를 작성하라.",
        "answer": "tar -xzf backup.tar.gz",
        "hint": "tar 명령어에서 x(extract), z(gzip), f(file) 옵션을 조합하세요.",
        "concept": "tar -xzf는 gzip으로 압축된 tar 아카이브를 현재 위치에 풀어낸다.",
    },
    {
        "title": "환경변수 출력",
        "category": "environment",
        "difficulty": "easy",
        "question": "현재 쉘 세션의 PATH 환경변수 값을 출력하는 명령어를 작성하라.",
        "answer": "echo $PATH",
        "hint": "echo 명령어와 $ 기호로 환경변수를 참조하세요.",
        "concept": "echo $변수명은 환경변수의 현재 값을 표준 출력으로 출력한다.",
    },
]


# ── Difficulty normalisation ──────────────────────────────────────────────────

def _normalise_difficulty(difficulty: str) -> str:
    """Map frontend difficulty names to names present in the mock pool.

    'beginner' is not in mock_data (pool only has easy/medium/hard), so we
    treat it as 'easy' for the purpose of pool lookup.
    """
    return "easy" if difficulty == "beginner" else difficulty


# ── Public API ────────────────────────────────────────────────────────────────

def generate_from_templates(category: str, difficulty: str, count: int) -> list[dict]:
    """Return *count* problems from MOCK_PROBLEMS with a four-level fallback.

    Fallback order (first non-empty pool wins):
      1. Exact match:  same category **and** same difficulty
      2. Same category, any difficulty
      3. Same difficulty, any category
      4. Entire MOCK pool
      5. _HARDCODED list (guaranteed non-empty)
    """
    lookup_diff = _normalise_difficulty(difficulty)

    # Level 1 – exact match
    pool = [
        p for p in MOCK_PROBLEMS
        if p["category"] == category and p["difficulty"] == lookup_diff
    ]

    # Level 2 – same category, any difficulty
    if not pool:
        pool = [p for p in MOCK_PROBLEMS if p["category"] == category]

    # Level 3 – same difficulty, any category
    if not pool:
        pool = [p for p in MOCK_PROBLEMS if p["difficulty"] == lookup_diff]

    # Level 4 – entire mock pool
    if not pool:
        pool = list(MOCK_PROBLEMS)

    # Level 5 – hardcoded absolute minimum
    if not pool:
        pool = list(_HARDCODED)

    picks = (
        random.choices(pool, k=count)
        if count > len(pool)
        else random.sample(pool, k=count)
    )

    out: list[dict] = []
    for p in picks:
        row = copy.deepcopy(p)
        # Stamp the requested category/difficulty so the DB row is consistent
        # with what the user asked for (the pool item may come from a different
        # category/difficulty when falling back).
        row["category"] = category
        row["difficulty"] = difficulty
        suffix = uuid.uuid4().hex[:6]
        row["title"] = f"{p['title']} · 연습 {suffix}"
        out.append(row)
    return out

"""Built-in problem pool for seeding and free-mode template generation."""

from __future__ import annotations

import json
from pathlib import Path

# Original curated problems (kept for continuity + grader regression variety)
_LEGACY: list[dict] = [
    {
        "title": "/var/log 디렉토리의 파일 목록 확인",
        "category": "file",
        "difficulty": "easy",
        "question": "/var/log 디렉토리 안에 있는 모든 파일과 디렉토리를 최신 수정 시간 순으로 나열하는 명령어를 작성하라.",
        "answer": ["ls -lt /var/log", "ls -tl /var/log"],
        "hint": "`ls`의 정렬 옵션 플래그를 확인해 보세요.",
        "concept": "ls 명령어의 -l(상세 출력), -t(시간 순 정렬) 옵션을 조합한다.",
    },
    {
        "title": "특정 확장자 파일 재귀 검색",
        "category": "file",
        "difficulty": "easy",
        "question": "/home 디렉토리 하위에서 확장자가 .conf인 파일을 모두 찾는 명령어를 작성하라.",
        "answer": ["find /home -name '*.conf'", 'find /home -name "*.conf"'],
        "hint": "`find` 명령어의 이름 패턴 옵션을 사용해 보세요.",
        "concept": "find 명령어에서 -name 옵션과 와일드카드(*)를 이용해 파일을 검색한다.",
    },
    {
        "title": "파일 내 문자열 검색",
        "category": "file",
        "difficulty": "easy",
        "question": "/etc/passwd 파일에서 'root'라는 문자열이 포함된 줄을 출력하는 명령어를 작성하라.",
        "answer": ["grep 'root' /etc/passwd", 'grep "root" /etc/passwd'],
        "hint": "`grep` 명령어의 기본 사용법을 떠올려 보세요.",
        "concept": "grep은 파일에서 패턴과 일치하는 줄을 출력하는 텍스트 검색 도구다.",
    },
    {
        "title": "하위 디렉토리 포함 문자열 검색",
        "category": "search",
        "difficulty": "medium",
        "question": "/etc 디렉토리 전체에서 'Port 22'라는 문자열이 있는 파일을 찾는 명령어를 작성하라.",
        "answer": ["grep -r 'Port 22' /etc", 'grep -r "Port 22" /etc'],
        "hint": "`grep`에서 하위 디렉토리까지 탐색하는 옵션이 있습니다.",
        "concept": "grep -r(recursive) 옵션을 사용하면 디렉토리를 재귀적으로 탐색한다.",
    },
    {
        "title": "파일 권한 변경 — 숫자 표기",
        "category": "permission",
        "difficulty": "easy",
        "question": "script.sh 파일의 권한을 소유자는 읽기/쓰기/실행, 그룹과 기타 사용자는 읽기/실행만 허용하도록 설정하는 명령어를 작성하라.",
        "answer": ["chmod 755 script.sh"],
        "hint": "소유자(rwx=7), 그룹(r-x=5), 기타(r-x=5)를 숫자로 표현해 보세요.",
        "concept": "chmod 숫자 표기법: r=4, w=2, x=1이며 세 자리로 소유자/그룹/기타 권한을 설정한다.",
    },
    {
        "title": "파일 소유자 변경",
        "category": "permission",
        "difficulty": "medium",
        "question": "/var/www/html/index.html 파일의 소유자를 www-data, 그룹도 www-data로 변경하는 명령어를 작성하라.",
        "answer": ["chown www-data:www-data /var/www/html/index.html"],
        "hint": "`chown` 명령어에서 소유자와 그룹을 동시에 지정하는 방법을 확인해 보세요.",
        "concept": "chown user:group file 형식으로 소유자와 그룹을 한 번에 변경할 수 있다.",
    },
    {
        "title": "실행 중인 전체 프로세스 확인",
        "category": "process",
        "difficulty": "easy",
        "question": "현재 시스템에서 실행 중인 모든 프로세스를 CPU 사용률 순으로 출력하는 명령어를 작성하라.",
        "answer": ["ps aux --sort=-%cpu", "ps aux --sort -%cpu"],
        "hint": "`ps aux` 결과를 정렬하는 옵션을 찾아보세요.",
        "concept": "ps aux는 모든 사용자의 프로세스를 상세 출력하며, --sort로 정렬 기준을 지정한다.",
    },
    {
        "title": "프로세스 강제 종료",
        "category": "process",
        "difficulty": "medium",
        "question": "PID가 1234인 프로세스를 즉시 강제 종료하는 명령어를 작성하라.",
        "answer": ["kill -9 1234", "kill -SIGKILL 1234", "kill -KILL 1234"],
        "hint": "시그널 번호 9(SIGKILL)는 프로세스를 강제 종료합니다.",
        "concept": "kill -9(SIGKILL)은 프로세스가 무시할 수 없는 종료 신호로, 즉시 강제 종료한다.",
    },
    {
        "title": "열린 포트 확인",
        "category": "network",
        "difficulty": "medium",
        "question": "현재 시스템에서 LISTEN 상태인 TCP 포트를 프로세스 정보와 함께 출력하는 명령어를 작성하라.",
        "answer": ["ss -tlnp", "ss -ltnp", "ss -tnlp", "ss -lntp", "ss -nltp", "ss -ntlp"],
        "hint": "`ss` 명령어의 상태 필터 옵션을 확인해 보세요.",
        "concept": "ss -t(TCP) -l(LISTEN) -n(숫자) -p(프로세스) 옵션으로 열린 포트를 확인한다.",
    },
    {
        "title": "HTTP 응답 헤더 확인",
        "category": "network",
        "difficulty": "easy",
        "question": "curl을 사용해 http://example.com 의 HTTP 응답 헤더만 출력하는 명령어를 작성하라.",
        "answer": ["curl -I http://example.com", "curl --head http://example.com"],
        "hint": "`curl`에서 헤더만 가져오는 옵션을 찾아보세요.",
        "concept": "curl -I(HEAD 요청)는 바디 없이 응답 헤더만 출력한다.",
    },
    {
        "title": "패키지 설치 (apt)",
        "category": "package",
        "difficulty": "easy",
        "question": "apt를 사용해 nginx 패키지를 설치하는 명령어를 작성하라. 확인 프롬프트 없이 자동으로 설치되어야 한다.",
        "answer": ["apt install -y nginx", "apt-get install -y nginx"],
        "hint": "프롬프트를 자동 수락하는 플래그를 추가해 보세요.",
        "concept": "apt install -y 옵션은 설치 확인 질문에 자동으로 yes를 응답한다.",
    },
    {
        "title": "패키지 완전 제거",
        "category": "package",
        "difficulty": "medium",
        "question": "apt를 사용해 nginx 패키지를 설정 파일까지 포함해 완전히 제거하는 명령어를 작성하라.",
        "answer": ["apt purge -y nginx", "apt-get purge -y nginx"],
        "hint": "`remove`와 `purge`의 차이를 생각해 보세요.",
        "concept": "apt purge는 패키지 바이너리뿐 아니라 설정 파일까지 함께 삭제한다.",
    },
]


def _load_json(filename: str) -> list[dict]:
    path = Path(__file__).resolve().parent / "data" / filename
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _merge_unique(*sources: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    out: list[dict] = []
    for source in sources:
        for row in source:
            key = (row["title"], row["category"], row["difficulty"])
            if key in seen:
                continue
            seen.add(key)
            out.append(row)
    return out


# Command problems: legacy curated + bulk JSON + extra JSON
_bulk = _load_json("bulk_problems.json")
_extra = _load_json("extra_problems.json")
MOCK_PROBLEMS: list[dict] = _merge_unique(_LEGACY, _bulk, _extra)

# Quiz (concept) problems loaded separately
_quiz_raw = _load_json("quiz_problems.json")
QUIZ_PROBLEMS: list[dict] = _merge_unique(_quiz_raw)

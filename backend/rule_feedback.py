"""Rule-based question-style hints when no cloud AI key is configured."""

import re


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def generate_rule_feedback(
    category: str,
    problem_title: str,
    question: str,
    user_answer: str,
) -> str:
    ua = _norm(user_answer)
    ql = question.lower()
    tl = problem_title.lower()
    chunks: list[str] = []

    # ── chmod / permission ─────────────────────────────────────────────
    if "chmod" in ua or "chmod" in ql or category == "permission":
        if "777" in ua.replace(" ", ""):
            chunks.append(
                "777은 모든 사용자에게 읽기·쓰기·실행을 모두 줍니다. "
                "문제에서 권한을 나눠줘야 하는 대상은 소유자·그룹·기타 중 누구인가요?"
            )
        elif "666" in ua.replace(" ", ""):
            chunks.append(
                "666은 실행 비트 없이 모두 읽기/쓰기만 줍니다. "
                "스크립트 실행이 필요한지, 디렉터리인지에 따라 필요한 비트가 달라질 수 있습니다. 문제 조건을 다시 확인해 보세요."
            )
        elif "+x" in ua or "a+x" in ua:
            chunks.append(
                "실행 비트만 추가하는 것이 맞나요, 아니면 읽기/쓰기 조합을 숫자로 한 번에 표현해야 하나요? "
                "문제가 요구하는 최종 권한 문자열(또는 숫자)을 정리해 보세요."
            )
        else:
            chunks.append(
                "숫자 모드(예: 755)와 기호 모드(u+rwx) 중 어떤 표기가 문제에 더 잘 맞나요? "
                "소유자/그룹/기타 각각에게 필요한 rwx를 나눠 적어 본 뒤 chmod 한 줄로 합쳐 보세요."
            )

    # ── grep / find / search ───────────────────────────────────────────
    if category in ("search", "file", "directory") or "grep" in ql or "find" in ql:
        if "grep" in ql and "grep" not in ua and "find" not in ua:
            chunks.append(
                "검색 대상이 ‘파일 내용’인가요, ‘파일 이름·경로’인가요? "
                "내용이면 grep 계열, 이름/트리 탐색이면 find 등이 적합할 수 있습니다."
            )
        if "find" in ql and "grep" in ua and "find" not in ua:
            chunks.append(
                "find는 디렉터리 트리를 걷는 도구이고, grep은 주로 텍스트 패턴에 씁니다. "
                "문제가 요구하는 건 디렉터리 순회인가요, 아니면 이미 지정된 파일 안의 문자열인가요?"
            )
        if "-r" not in ua and ("하위" in ql or "재귀" in ql or "recursive" in ql):
            chunks.append(
                "하위 디렉터리까지 포함해야 한다면, 사용하는 명령에 재귀 옵션이 필요한지 확인해 보세요."
            )

    # ── process ────────────────────────────────────────────────────────
    if category == "process" or "ps" in ql or "kill" in ql or "프로세스" in ql:
        if "kill" in ql and "kill" not in ua:
            chunks.append(
                "프로세스를 끝낼 때는 먼저 PID를 어떻게 찾을지, 그다음 어떤 시그널을 보낼지 순서를 정리해 보세요."
            )
        if "ps" in ql and "aux" not in ua and "ps" in ua:
            chunks.append(
                "ps 출력에서 CPU·메모리 순으로 보고 싶다면, ps만으로 충분한지 정렬/헤더 옵션이 더 필요한지 비교해 보세요."
            )
        if "top" in ua and "htop" not in ua and "정렬" in ql:
            chunks.append(
                "실시간 화면(top)과 한 스냅샷(ps) 중 문제가 원하는 출력 형태는 무엇인가요?"
            )

    # ── network ───────────────────────────────────────────────────────
    if category == "network" or "port" in ql or "curl" in ql or "ss " in ql or "ping" in ql:
        if "listen" in ql or "포트" in ql or "열린" in tl:
            if "netstat" in ua and "ss" not in ua:
                chunks.append(
                    "최신 배포판에서는 ss가 흔히 권장됩니다. TCP·LISTEN·프로세스 정보를 동시에 보려면 어떤 조합이 필요할까요?"
                )
            chunks.append(
                "TCP인지 UDP인지, LISTEN 상태만 볼지 먼저 구분해 보세요. 숫자 포트와 프로세스 이름을 함께 보려면 어떤 플래그가 필요할까요?"
            )
        if "curl" in ql and "header" in ql and "-i" in ua and "-I" not in ua:
            chunks.append(
                "응답 헤더만 보고 싶다면 HEAD 요청과 동일한 효과의 옵션이 있는지, 바디까지 포함하는 옵션과 차이를 비교해 보세요."
            )
        if "ping" in ql and "-c" not in ua:
            chunks.append(
                "ping이 무한히 나가지 않도록 횟수를 제한하는 옵션이 있었는지 확인해 보세요."
            )

    # ── package ─────────────────────────────────────────────────────────
    if category == "package" or "apt" in ql or "dnf" in ql or "yum" in ql:
        if "install" in ql and "-y" not in ua and "assume" not in ua:
            chunks.append(
                "비대화형 환경에서 설치를 자동으로 진행하려면 확인 프롬프트를 건너뛰는 플래그가 필요할 수 있습니다."
            )
        if "purge" in ql or "완전" in ql:
            chunks.append(
                "remove와 purge(설정 파일까지 제거) 중 문제가 요구하는 쪽은 어느 쪽인가요?"
            )

    # ── service (systemd) ─────────────────────────────────────────────
    if category == "service" or "systemctl" in ql:
        if "systemctl" not in ua and "service" not in ua:
            chunks.append(
                "systemd 환경에서는 unit 상태를 보거나 시작/중지할 때 어떤 하위 명령(start, stop, status 등)을 쓰는지 정리해 보세요."
            )

    # ── compression ───────────────────────────────────────────────────
    if category == "compression" or "tar" in ql or "gzip" in ql or "zip" in ql:
        if "tar" in ql and "z" not in ua and "gzip" in ql:
            chunks.append(
                "아카이브를 gzip으로 압축하려면 tar에 압축을 켜는 짧은 옵션이 필요합니다. 순서(옵션 위치)도 맞는지 확인해 보세요."
            )

    # ── environment ───────────────────────────────────────────────────
    if category == "environment" or "export" in ql or "PATH" in ql or "env" in ql:
        if "export" not in ua and "=" in ua:
            chunks.append(
                "현재 셸 세션에 변수를 남기려면 export가 필요한지, 일회성으로만 앞에 붙이면 되는지 문제 조건과 비교해 보세요."
            )

    # ── directory ─────────────────────────────────────────────────────
    if category == "directory" or "mkdir" in ql or "rmdir" in ql or "cd" in ql:
        if "mkdir" in ql and "-p" not in ua and ("하위" in ql or "중첩" in ql):
            chunks.append(
                "중간 경로가 없을 때 한 번에 만들려면 부모 디렉터리까지 같이 만드는 옵션이 필요할 수 있습니다."
            )

    # ── dedupe & default ───────────────────────────────────────────────
    seen: set[str] = set()
    uniq = []
    for c in chunks:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    if uniq:
        return " ".join(uniq[:2])

    # Category fallbacks (question-style, no direct answer)
    fallbacks = {
        "file": "문제가 요구하는 건 ‘목록’, ‘복사’, ‘내용 보기’ 중 어떤 동작에 가장 가깝나요? 그에 맞는 단일 명령을 골라 보세요.",
        "directory": "경로를 만들 때, 이미 존재해도 실패하지 않게 하거나 부모까지 한 번에 만드는 옵션이 필요한지 생각해 보세요.",
        "permission": "소유자·그룹·기타 각각에 필요한 rwx를 먼저 표로 적은 뒤, chmod 숫자나 기호 표기로 옮겨 보세요.",
        "process": "PID를 구한 뒤 시그널을 보내는 흐름인지, 한 화면에서 상태를 보는 흐름인지 문제 문장을 다시 읽어 보세요.",
        "network": "로컬의 LISTEN 포트를 볼 것인지, 원격 HTTP 헤더를 볼 것인지 먼저 구분하면 명령 선택이 쉬워집니다.",
        "package": "설치·제거·검색 중 어떤 작업인지, 그리고 확인 없이 진행해야 하는지(비대화형)를 체크해 보세요.",
        "service": "unit 이름과 원하는 상태(시작/중지/재시작/부팅 시 자동) 중 무엇을 만족시켜야 하나요?",
        "search": "패턴이 파일 ‘안’의 내용인지, 파일 ‘이름’인지에 따라 grep과 find의 역할이 갈립니다.",
        "compression": "여러 파일을 하나의 아카이브로 묶는지, 기존 파일을 덮어쓰며 압축만 하는지 목표를 먼저 정리해 보세요.",
        "environment": "변수를 현재 셸에 남길지, 한 번 실행에만 쓸지에 따라 export 여부가 달라질 수 있습니다.",
    }
    return fallbacks.get(
        category,
        "문제 문장에서 ‘입력/대상/출력 형식’ 세 가지를 각각 밑줄 친 뒤, 그에 맞는 명령 한 줄을 다시 구성해 보세요.",
    )

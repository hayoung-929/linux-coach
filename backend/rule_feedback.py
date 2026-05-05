"""Rule-based question-style coach feedback for Free Rule Mode.

Designed to feel like a real Linux coach:
- Identifies *why* the answer is wrong (when possible)
- Connects to the related concept and a real-world situation
- Uses Socratic-style questions to guide thinking
- Suggests next thing to look up — never reveals the literal answer

Templates are keyed by (category, difficulty) and combined with answer-specific
heuristics (e.g. user typed `chmod 777` → permission scope question).
"""

from __future__ import annotations

import re

# ── Helpers ───────────────────────────────────────────────────────────────────


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _tokens(s: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9_/\-+\.]+", s.lower())


def _contains_any(s: str, *needles: str) -> bool:
    return any(n in s for n in needles)


# ── Answer-pattern heuristics ─────────────────────────────────────────────────
# Each returns a list of feedback paragraphs (or empty list).


def _check_permission(ua: str, ql: str) -> list[str]:
    out: list[str] = []
    no_space = ua.replace(" ", "")
    if "777" in no_space:
        out.append(
            "777은 모든 사용자에게 읽기·쓰기·실행을 모두 부여하는 가장 위험한 권한이에요. "
            "문제에서 권한을 제한해야 하는 대상이 누구인지 다시 짚어보면, "
            "소유자(owner)에게는 어떤 비트를, 그룹과 기타에게는 어떤 비트를 줘야 할까요?"
        )
    elif "666" in no_space:
        out.append(
            "666은 실행 비트(x) 없이 모두에게 읽기·쓰기를 줍니다. "
            "스크립트 파일이라면 실행 권한이 필요하고, 디렉터리라면 안에 들어가기 위해 x가 필요해요. "
            "이 문제의 대상이 일반 텍스트인지, 실행 가능한 파일인지, 디렉터리인지 먼저 분류해보세요."
        )
    elif re.search(r"\b000\b", no_space):
        out.append(
            "000은 모든 권한을 박탈해서 소유자조차 접근할 수 없게 만듭니다. "
            "일반적인 ‘제한’과 ‘차단’은 다른 의도예요. 문제는 누구의 어떤 권한을 ‘남기는’ 것인가요?"
        )
    elif "+x" in ua or "a+x" in ua:
        out.append(
            "기호 모드의 +x는 ‘실행 비트만 추가’하는 동작이에요. "
            "문제가 권한을 새로 ‘설정’하는지, 기존 권한에 ‘덧붙이는지’ 구분해보세요. "
            "전체 권한을 한 번에 표현하고 싶다면 숫자 모드(예: 755, 644, 600)가 더 명확합니다."
        )
    elif "chown" in ua and "chmod" in ql:
        out.append(
            "chown은 소유자/그룹을 바꾸고, chmod는 권한 비트(rwx)를 바꿉니다. "
            "문제가 ‘누가 가진 파일이냐’를 묻는지, ‘누가 무엇을 할 수 있냐’를 묻는지 다시 읽어보세요."
        )
    elif "chmod" in ql and "chmod" not in ua:
        out.append(
            "권한을 바꿀 때 가장 흔히 쓰는 명령은 무엇일까요? "
            "rwx 세 글자를 소유자·그룹·기타 순서대로 적어본 뒤 숫자(8진수)로 환산해보면 명령이 자연스럽게 떠오를 거예요."
        )
    return out


def _check_search(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if "find" in ql and "grep" in ua and "find" not in ua:
        out.append(
            "검색의 대상이 ‘파일 이름이나 경로’인지, ‘파일 내용 안의 문자열’인지 먼저 구분해보세요. "
            "이름·경로 탐색은 find, 텍스트 패턴은 grep이 표준이에요. "
            "이 문제는 디렉터리 트리를 따라 ‘이름’을 찾는 작업에 가깝지 않나요?"
        )
    if "grep" in ql and "grep" not in ua and "find" not in ua:
        out.append(
            "큰 텍스트에서 특정 패턴이 들어간 ‘줄’만 보고 싶을 때 가장 자주 쓰는 도구는 grep이에요. "
            "grep ‘패턴’ 파일 형태로 시작해보면 어떨까요?"
        )
    if "-r" not in ua and "-R" not in ua and _contains_any(ql, "하위", "재귀", "recursive", "디렉터리 전체"):
        out.append(
            "하위 폴더까지 모두 훑어야 한다면 명령에 재귀 옵션이 필요해요. "
            "grep은 -r, find는 기본적으로 재귀라는 점을 떠올리고, 어떤 도구가 더 적합한지 다시 골라보세요."
        )
    if "-i" not in ua and _contains_any(ql, "대소문자 구분 없이", "case", "대소문자 무시"):
        out.append(
            "대소문자를 구분하지 않으려면 grep에는 대소문자를 무시하는 짧은 옵션이 있어요. "
            "그 옵션을 함께 써보면 결과가 바뀝니다."
        )
    if "-name" not in ua and "find" in ua:
        out.append(
            "find로 이름 패턴을 거를 때는 어떤 옵션이 표준이었을까요? "
            "-name, -iname, -path 중 어떤 것이 이 문제에 가장 잘 맞는지 비교해보세요."
        )
    return out


def _check_process(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if "kill" in ql and "kill" not in ua:
        out.append(
            "프로세스를 끝낼 때는 두 단계가 필요해요. "
            "① PID(프로세스 번호)를 어떻게 찾을지, ② 어떤 시그널을 보낼지. "
            "응답이 없을 땐 정상 종료(SIGTERM=15)가 아니라 강제 종료(SIGKILL=9)를 써야 할 수 있어요."
        )
    if "ps" in ua and "aux" not in ua and ("정렬" in ql or "cpu" in ql.lower() or "메모리" in ql):
        out.append(
            "ps만으로는 시스템 전체 프로세스가 보이지 않을 수 있어요. "
            "‘모든 사용자’ + ‘자세한 형식’을 함께 보려면 ps에 어떤 인자 조합이 흔히 쓰일까요? "
            "정렬 기준이 필요하다면 --sort 옵션도 떠올려보세요."
        )
    if _contains_any(ql, "강제", "응답", "안 끝") and "-9" not in ua and "kill" in ua:
        out.append(
            "정상 종료에 응답하지 않는 프로세스에는 어떤 시그널이 효과적일까요? "
            "kill의 시그널 번호 중 ‘무시할 수 없는’ 종료 신호를 떠올려보세요."
        )
    if "top" in ua and _contains_any(ql, "한 번", "스냅샷", "한 줄"):
        out.append(
            "top은 실시간으로 갱신되는 화면이에요. 한 번만 출력해서 파이프로 연결하거나 로그에 남기고 싶다면 ps 계열이 더 적합할 때가 많습니다."
        )
    return out


def _check_network(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if _contains_any(ql, "listen", "포트", "열린 포트"):
        if "netstat" in ua and "ss" not in ua:
            out.append(
                "최신 배포판에서는 netstat 대신 ss가 권장돼요. "
                "TCP·LISTEN·프로세스 정보를 한 줄에 모두 보려면 ss에 어떤 짧은 옵션 조합을 붙여야 할까요? "
                "(힌트: t = TCP, l = LISTEN, n = 숫자, p = 프로세스)"
            )
        elif "ss" not in ua:
            out.append(
                "지금 어떤 포트가 열려 있는지 보려면 ss 명령을 떠올려보세요. "
                "TCP만 볼지·UDP까지 볼지, LISTEN 상태만 필터링할지를 옵션으로 표현할 수 있어요."
            )
    if "curl" in ql and "header" in ql.lower():
        if "-i" in ua and "-I" not in ua:
            out.append(
                "응답 ‘본문 + 헤더’를 같이 보려면 -i, ‘헤더만’ 받고 싶을 땐 -I(HEAD)예요. "
                "이 문제는 어떤 정보가 필요할까요? 옵션 대소문자 차이도 의미가 다르다는 점이 핵심입니다."
            )
    if "ping" in ql and "-c" not in ua and "ping" in ua:
        out.append(
            "ping은 기본적으로 무한히 패킷을 보냅니다. "
            "정해진 횟수만 보내고 자동 종료되게 하려면 어떤 옵션을 쓰는지 떠올려보세요. (Ctrl+C 없이도 끝나게요.)"
        )
    if _contains_any(ql, "ip 주소", "인터페이스") and "ifconfig" in ua and "ip " not in ua:
        out.append(
            "ifconfig는 점점 deprecated 되고 있어요. 최신 시스템에서는 ip 명령이 표준입니다. "
            "ip의 어떤 하위 명령이 인터페이스/IP 정보를 보여줄까요?"
        )
    return out


def _check_package(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if "install" in ql and "-y" not in ua and "assume" not in ua and ("자동" in ql or "확인 없이" in ql or "비대화" in ql):
        out.append(
            "스크립트나 자동화에서는 설치 중 ‘Y/n’ 프롬프트가 멈추면 곤란해요. "
            "확인 질문을 자동 수락하는 짧은 플래그가 apt/yum 모두 있어요. 어떤 글자였는지 떠올려보세요."
        )
    if _contains_any(ql, "완전 제거", "설정 파일까지", "purge"):
        if "purge" not in ua and "remove" in ua:
            out.append(
                "remove는 패키지 바이너리만 지우고 /etc 아래 설정 파일은 남겨둬요. "
                "설정까지 함께 정리하고 싶을 땐 어떤 하위 명령으로 바꿔야 할까요?"
            )
    if "update" not in ua and _contains_any(ql, "최신", "갱신", "Unable to locate"):
        out.append(
            "‘설치 가능한 패키지 목록’이 최신이 아니면 install이 실패하기도 해요. "
            "install 전에 어떤 명령을 한 번 돌려서 메타데이터를 갱신해야 할까요?"
        )
    return out


def _check_service(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if "systemctl" not in ua and "service" not in ua:
        out.append(
            "systemd 환경에서 서비스의 생명주기를 다룰 때는 systemctl이 표준이에요. "
            "지금 필요한 동작이 ‘즉시 시작’인지, ‘부팅 시 자동 시작’인지, ‘설정만 다시 읽기’인지 먼저 분류해보세요. "
            "각각 start, enable, reload 같은 하위 명령에 매핑됩니다."
        )
    if _contains_any(ql, "부팅", "재부팅", "자동 시작") and "enable" not in ua:
        out.append(
            "지금 한 번 실행(start)과 부팅 시마다 자동 실행(enable)은 별개의 동작이에요. "
            "지속적인 동작이 필요하다면 어떤 하위 명령을 써야 할까요?"
        )
    if _contains_any(ql, "설정", "reload", "무중단") and "reload" not in ua and "restart" in ua:
        out.append(
            "restart는 프로세스를 끄고 다시 띄우면서 짧은 다운타임이 있어요. "
            "설정만 다시 읽으면 충분한 경우엔 어떤 하위 명령으로 바꾸는 게 더 안전할까요?"
        )
    if _contains_any(ql, "로그", "journal") and "journalctl" not in ua:
        out.append(
            "systemd 기반 서비스의 로그는 어디에서 통합 조회할까요? "
            "특정 unit만 보고 싶다면 -u 옵션, 실시간 추적은 -f 옵션을 떠올려보세요."
        )
    return out


def _check_compression(ua: str, ql: str) -> list[str]:
    out: list[str] = []
    if "tar" in ql:
        if "z" not in ua and ("gzip" in ql or ".gz" in ql):
            out.append(
                "tar는 ‘여러 파일을 한 묶음으로’ 만드는 도구이고, gzip은 그 묶음을 ‘압축’해요. "
                "두 작업을 한 번에 하려면 tar 옵션 중 압축을 켜는 짧은 글자가 필요해요."
            )
        if "x" in ql and "x" not in ua and ("풀" in ql or "해제" in ql):
            out.append(
                "압축 해제(extract)와 만들기(create)는 tar의 첫 글자 옵션이 달라요. "
                "x와 c 중 어떤 쪽이 ‘풀기’였는지 떠올려보세요."
            )
    if "zip" in ql and "-r" not in ua and ("폴더" in ql or "디렉터리" in ql):
        out.append(
            "zip 명령으로 디렉터리 전체를 묶으려면 재귀 옵션이 필요해요. "
            "그렇지 않으면 디렉터리 자체만 추가되고 안의 파일이 빠질 수 있어요."
        )
    return out


def _check_environment(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if "=" in ua and "export" not in ua and _contains_any(ql, "자식", "다른 프로세스", "환경"):
        out.append(
            "VAR=값 만 적으면 ‘현재 셸 안에서만’ 쓰이는 변수예요. "
            "자식 프로세스(예: 실행한 스크립트)에서도 보이게 하려면 어떤 키워드가 앞에 붙어야 할까요?"
        )
    if "$path" in ua.lower() and "echo" not in ua:
        out.append(
            "환경변수 값을 ‘출력’하려면 어떤 명령과 조합해야 할까요? "
            "$를 붙여 참조한 뒤 결과를 보여주는 가장 기본 명령을 떠올려보세요."
        )
    if _contains_any(ql, "영구", "재시작", "다음 세션") and "rc" not in ua and "profile" not in ua:
        out.append(
            "셸을 새로 열 때마다 변수가 살아있게 하려면 어떤 시작 스크립트에 export를 추가해야 할까요? "
            "bash라면 ~/.bashrc, zsh라면 ~/.zshrc가 흔히 쓰이는 위치예요."
        )
    return out


def _check_directory(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if "mkdir" in ql and "-p" not in ua and _contains_any(ql, "중간", "하위", "한 번에", "중첩"):
        out.append(
            "중간 경로의 디렉터리들이 아직 없다면 mkdir 만으로는 만들 수 없어요. "
            "‘부모 디렉터리도 함께’ 만들어주는 옵션이 있어요. 어떤 글자였는지 떠올려보세요."
        )
    if "rmdir" in ua and "비어" not in ql and _contains_any(ql, "전체", "안에 파일", "내용"):
        out.append(
            "rmdir는 빈 디렉터리만 지울 수 있어요. 안에 파일이 있다면 어떤 명령과 옵션 조합으로 바꿔야 할까요? "
            "‘재귀’와 ‘강제’의 의미를 한 번 더 짚어보세요."
        )
    return out


def _check_file(ua: str, ql: str, tl: str) -> list[str]:
    out: list[str] = []
    if _contains_any(ql, "끝", "마지막") and "head" in ua:
        out.append(
            "head는 파일의 ‘앞부분’을 보여줘요. 마지막 줄을 보고 싶다면 어떤 명령이 더 자연스러울까요?"
        )
    if _contains_any(ql, "실시간", "follow") and "-f" not in ua and "tail" in ua:
        out.append(
            "tail로 새로 쌓이는 줄을 ‘실시간으로 따라가려면’ 어떤 옵션이 필요할까요? 한 글자입니다."
        )
    if _contains_any(ql, "복사") and "cp" not in ua and "mv" in ua:
        out.append(
            "mv는 ‘이동/이름 변경’이라 원본이 사라져요. 원본을 그대로 두고 사본만 만들려면 어떤 명령으로 바꿔야 할까요?"
        )
    return out


# ── Difficulty-aware closing nudges ───────────────────────────────────────────


_DIFFICULTY_NUDGE = {
    "beginner": (
        "지금은 명령어 하나·옵션 하나가 어떤 동작을 하는지 ‘이름의 뜻’과 함께 외우는 게 가장 빠른 길이에요. "
        "예를 들어 ls = list, cp = copy, rm = remove 처럼요. 키워드를 입에 붙여보세요."
    ),
    "easy": (
        "단어와 개념이 익숙해졌다면, 이제 ‘옵션 한 글자가 어떤 차이를 만드는가’에 집중해보세요. "
        "man 페이지에서 같은 명령의 -a, -l, -h 같은 옵션을 비교해두면 응용이 빨라져요."
    ),
    "medium": (
        "이 난이도부터는 ‘여러 명령을 파이프로 잇는 흐름’을 익히는 게 핵심이에요. "
        "출력 형식(표준 출력 vs 표준 에러), 정렬, 필터링을 머릿속으로 한 번 그려본 뒤 한 줄로 합쳐보세요."
    ),
    "hard": (
        "여러 도구의 조합·정규식·시그널 처리 같은 ‘응용’이 등장합니다. "
        "스크립트로 만들어 재사용할 수 있는지, 안전성(예: --dry-run, set -euo pipefail)이 충분한지도 함께 고민해보세요."
    ),
}


# ── Category fallback nudges (no answer-pattern match) ────────────────────────


_CATEGORY_FALLBACKS = {
    "file":        "이 문제가 요구하는 동작이 ‘목록 보기’, ‘내용 보기’, ‘복사/이동/삭제’, ‘검색’ 중 어디에 가까운지 먼저 분류해보세요. 분류가 끝나면 해당 카테고리의 대표 명령 하나가 떠오를 거예요.",
    "directory":   "디렉터리 작업의 핵심은 ‘만들기(mkdir) / 들어가기(cd) / 비우기(rm/rmdir) / 보기(ls, tree)’의 네 갈래예요. 문제 문장에서 어떤 동작이 핵심인지 한 단어로 적어본 뒤 그에 맞는 명령을 골라보세요.",
    "permission":  "권한 문제는 ‘소유자 / 그룹 / 기타’ 세 칸과 ‘r / w / x’ 세 칸의 표를 머릿속에 그리는 것에서 시작해요. 표가 정해지면 숫자(예: 755)나 기호(u+rwx)로 옮기는 건 거의 자동입니다.",
    "process":     "프로세스 문제는 거의 항상 ‘찾기(ps/pgrep) → 신호 보내기(kill) → 모니터링(top/htop)’의 흐름이에요. 문제가 어느 단계인지 표시해보면 도구 선택이 쉬워집니다.",
    "network":     "네트워크 문제는 ‘우리 쪽’과 ‘저쪽’ 어느 방향인지 먼저 구분하세요. 우리 쪽 포트/인터페이스라면 ss·ip 계열, 외부 호출이라면 ping·curl·dig 계열이 자연스러워요.",
    "package":     "패키지 작업은 ‘목록 갱신(update) → 설치/제거 → 설정까지 정리(purge)’의 순서를 자주 따라요. 비대화형(자동 yes)을 켜야 하는지도 함께 결정해보세요.",
    "service":     "service 문제는 ‘지금 한 번 / 부팅마다 / 설정만 다시 읽기’ 중 무엇을 원하는지가 핵심이에요. 각각 start, enable, reload로 매핑된다는 점을 떠올려보세요.",
    "search":      "검색은 ‘파일 안의 문자열’ vs ‘파일 이름/경로’의 두 갈래로 갈립니다. 문제 문장에서 ‘어디를’ 검색하는지에 동그라미를 쳐보면 도구가 쉽게 골라져요.",
    "compression": "압축 문제의 절반은 ‘묶기(tar)’와 ‘압축(gzip)’이 다른 작업이라는 점을 인식하는 데서 풀려요. 두 가지를 한 줄에 합칠지, .zip이 더 적합할지(상대방 OS) 같이 따져보세요.",
    "environment": "환경/셸 문제는 ‘이번 줄만 vs 이번 셸 vs 영구적’의 세 단계를 늘 의식하면 좋아요. 어디에 정의해야 하는지 정해지면 명령은 export, ~/.bashrc 같은 식으로 자연스럽게 따라옵니다.",
}


# ── Public entry point ───────────────────────────────────────────────────────


def generate_rule_feedback(
    category: str,
    problem_title: str,
    question: str,
    user_answer: str,
    difficulty: str = "easy",
) -> str:
    """Return a multi-paragraph coaching feedback string.

    Never reveals the exact answer; uses Socratic questions and concept hooks.
    """
    ua = _norm(user_answer)
    ql = question.lower()
    tl = problem_title.lower()

    chunks: list[str] = []

    # Empty answer
    if not ua:
        chunks.append(
            "답을 비워 두고 제출했네요. 문제 문장에서 ‘무엇을 / 어디서 / 어떤 형식으로’ "
            "가 각각 무엇인지 한 줄씩 적어본 뒤, 그에 가장 가까운 명령 하나를 떠올려보세요. "
            "한 글자라도 적어보는 게 시작이에요."
        )

    # Category-specific answer-pattern checks
    by_cat = {
        "permission":  _check_permission(ua, ql),
        "search":      _check_search(ua, ql, tl),
        "process":     _check_process(ua, ql, tl),
        "network":     _check_network(ua, ql, tl),
        "package":     _check_package(ua, ql, tl),
        "service":     _check_service(ua, ql, tl),
        "compression": _check_compression(ua, ql),
        "environment": _check_environment(ua, ql, tl),
        "directory":   _check_directory(ua, ql, tl),
        "file":        _check_file(ua, ql, tl),
    }
    chunks.extend(by_cat.get(category, []))

    # Cross-category heuristics that often match too
    if category != "permission" and ("chmod" in ua or "chmod" in ql):
        chunks.extend(_check_permission(ua, ql))
    if category not in ("search", "file") and ("grep" in ua or "find" in ua):
        chunks.extend(_check_search(ua, ql, tl))

    # Dedupe while preserving order
    seen: set[str] = set()
    uniq: list[str] = []
    for c in chunks:
        if c and c not in seen:
            seen.add(c)
            uniq.append(c)

    # Take at most 2 specific paragraphs
    body = uniq[:2]

    # If we found nothing specific, use category fallback
    if not body:
        body.append(_CATEGORY_FALLBACKS.get(
            category,
            "문제 문장을 ‘입력 / 대상 / 출력 형식’ 세 부분으로 나눠 다시 읽고, 각 부분에 가장 잘 맞는 명령을 한 줄로 합쳐보세요.",
        ))

    # Always close with a difficulty-aware nudge
    body.append(_DIFFICULTY_NUDGE.get(difficulty, _DIFFICULTY_NUDGE["easy"]))

    return "\n\n".join(body)

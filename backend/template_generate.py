"""Variable-substitution template pool for free-mode problem generation.

Each template contains {PLACEHOLDER} tokens that are replaced with fresh random
values on every call, so the same template produces visually distinct problems
each time it is used.

Guarantees ≥1 problem always, regardless of category / difficulty combination.
"""

from __future__ import annotations

import re
import random
import uuid

# ── Variable pools ────────────────────────────────────────────────────────────

_POOLS: dict[str, list[str]] = {
    "file":     ["report.txt", "config.conf", "data.csv", "backup.sh", "notes.md",
                 "server.log", "app.py", "index.html", "script.sh", "output.log",
                 "access.log", "settings.ini", "deploy.sh", "readme.txt"],
    "file2":    ["result.txt", "archive.log", "copy.conf", "new_data.csv",
                 "dump.sql", "snapshot.bak", "converted.txt"],
    "dir":      ["logs", "backup", "tmp", "data", "projects", "config",
                 "uploads", "cache", "dist", "assets", "reports", "var"],
    "dir2":     ["archive", "old", "new_dir", "output", "temp", "processed"],
    "process":  ["nginx", "python3", "node", "mysqld", "redis-server",
                 "sshd", "apache2", "postgres", "gunicorn", "celery"],
    "service":  ["nginx", "mysql", "redis", "ssh", "postgresql",
                 "docker", "apache2", "cron", "ufw", "fail2ban"],
    "port":     ["8080", "3000", "5432", "6379", "3306", "9000", "4000", "8443", "8888"],
    "user":     ["alice", "bob", "deploy", "admin", "ubuntu", "webuser", "devops", "jenkins"],
    "group":    ["www-data", "sudo", "docker", "staff", "developers", "webgroup", "adm"],
    "package":  ["curl", "wget", "git", "vim", "htop", "jq", "tree",
                 "unzip", "ncdu", "net-tools", "nmap", "rsync", "tmux"],
    "archive":  ["backup.tar.gz", "data.zip", "logs.tar.bz2",
                 "project.tar", "images.tar.gz", "release.tar.gz"],
    "env_var":  ["DATABASE_URL", "API_KEY", "SECRET_KEY", "PORT",
                 "NODE_ENV", "APP_ENV", "REDIS_URL", "LOG_LEVEL"],
    "keyword":  ["error", "warning", "timeout", "FAILED", "denied", "refused",
                 "exception", "critical", "panic", "fatal"],
    "pid":      ["1234", "5678", "9012", "3456", "7890", "2048", "4096"],
    "perm":     ["755", "644", "700", "750", "640", "600", "664"],
    "dest":     ["/tmp", "/home/deploy", "/var/backup", "/opt/data", "/srv/data"],
    "signal":   ["SIGTERM", "SIGKILL", "SIGHUP", "SIGINT"],
    "signal_n": ["15", "9", "1", "2"],
    "iface":    ["eth0", "ens3", "enp0s3", "ens33", "ens160"],
    "ip":       ["192.168.1.100", "10.0.0.5", "172.16.0.10",
                 "192.168.0.50", "10.10.1.20"],
    "line_n":   ["10", "20", "50", "100", "30"],
    "size":     ["10M", "100M", "1G", "500M", "50M"],
}


def _fill(template: dict) -> dict:
    """Substitute all {POOL_KEY} placeholders with consistent random values.

    The same key always gets the same random value within one call, so
    {file} in the title and {file} in the answer refer to the same filename.
    """
    # Collect which placeholder keys appear in any string field
    placeholders: set[str] = set()
    for val in template.values():
        if isinstance(val, str):
            placeholders.update(re.findall(r"\{(\w+)\}", val))

    # Pick one random value per key (only for keys that exist in _POOLS)
    bindings: dict[str, str] = {}
    for key in placeholders:
        if key in _POOLS:
            bindings[key] = random.choice(_POOLS[key])

    # Substitute placeholders
    result: dict = {}
    for field, val in template.items():
        if isinstance(val, str):
            for k, v in bindings.items():
                val = val.replace(f"{{{k}}}", v)
        result[field] = val
    return result


# ── Template pool ─────────────────────────────────────────────────────────────
# Each entry: category, difficulty, title, question, answer, hint, concept.
# Use {POOL_KEY} placeholders in any string field.

_POOL: list[dict] = [
    # ═══════════════════════════════════════════════════════════════ FILE ════
    {
        "category": "file", "difficulty": "easy",
        "title": "{file} 복사",
        "question": "현재 디렉터리에 있는 {file} 파일을 {file2}라는 이름으로 복사하는 명령어를 작성하라.",
        "answer": "cp {file} {file2}",
        "hint": "cp 명령어는 '원본 대상' 순서로 인수를 받습니다.",
        "concept": "cp(copy) 명령어로 파일을 복사한다. 원본 파일은 그대로 유지된다.",
    },
    {
        "category": "file", "difficulty": "easy",
        "title": "{file} 삭제",
        "question": "현재 디렉터리의 {file} 파일을 삭제하는 명령어를 작성하라.",
        "answer": "rm {file}",
        "hint": "rm(remove) 명령어를 사용합니다. 삭제 후 복구가 불가능합니다.",
        "concept": "rm 명령어는 파일을 삭제한다. 복구가 불가능하므로 주의해야 한다.",
    },
    {
        "category": "file", "difficulty": "easy",
        "title": "{file}을 {dir}로 이동",
        "question": "현재 디렉터리의 {file} 파일을 {dir} 디렉터리 안으로 이동하는 명령어를 작성하라.",
        "answer": "mv {file} {dir}/",
        "hint": "mv(move) 명령어는 파일 이동과 이름 변경 모두에 사용됩니다.",
        "concept": "mv 명령어는 파일이나 디렉터리를 다른 위치로 이동하거나 이름을 바꾼다.",
    },
    {
        "category": "file", "difficulty": "easy",
        "title": "숨김 파일 포함 목록 확인",
        "question": "현재 디렉터리의 모든 파일(숨김 파일 포함)을 상세 목록으로 출력하는 명령어를 작성하라.",
        "answer": "ls -la",
        "hint": "ls 명령어의 -a(all)와 -l(long) 옵션을 조합하세요.",
        "concept": "ls -la는 .으로 시작하는 숨김 파일을 포함하여 권한, 소유자 등의 상세 정보를 출력한다.",
    },
    {
        "category": "file", "difficulty": "easy",
        "title": "{file} 내용 출력",
        "question": "{file} 파일의 내용을 터미널에 출력하는 명령어를 작성하라.",
        "answer": "cat {file}",
        "hint": "cat(concatenate) 명령어로 파일 내용을 출력할 수 있습니다.",
        "concept": "cat 명령어는 파일의 전체 내용을 표준 출력으로 출력한다.",
    },
    {
        "category": "file", "difficulty": "easy",
        "title": "{file} 이름 변경",
        "question": "{file} 파일의 이름을 {file2}로 변경하는 명령어를 작성하라.",
        "answer": "mv {file} {file2}",
        "hint": "mv 명령어는 같은 디렉터리 내에서 이름 변경 역할도 합니다.",
        "concept": "mv는 파일 이름을 바꿀 때도 사용된다. 같은 디렉터리 내에서 이름만 바꾸는 효과다.",
    },
    {
        "category": "file", "difficulty": "medium",
        "title": "{file} 마지막 {line_n}줄 확인",
        "question": "{file} 파일의 마지막 {line_n}줄만 출력하는 명령어를 작성하라.",
        "answer": "tail -n {line_n} {file}",
        "hint": "tail 명령어의 -n 옵션으로 출력할 줄 수를 지정합니다.",
        "concept": "tail -n N은 파일의 마지막 N줄을 출력한다. 로그 파일 확인 시 자주 사용된다.",
    },
    {
        "category": "file", "difficulty": "medium",
        "title": "{file} 처음 {line_n}줄 확인",
        "question": "{file} 파일의 처음 {line_n}줄만 출력하는 명령어를 작성하라.",
        "answer": "head -n {line_n} {file}",
        "hint": "head 명령어의 -n 옵션으로 출력할 줄 수를 지정합니다.",
        "concept": "head -n N은 파일의 처음 N줄을 출력한다.",
    },
    {
        "category": "file", "difficulty": "medium",
        "title": "{file} 줄 수 세기",
        "question": "{file} 파일의 총 줄 수를 출력하는 명령어를 작성하라.",
        "answer": "wc -l {file}",
        "hint": "wc(word count) 명령어의 -l 옵션으로 줄 수를 셉니다.",
        "concept": "wc -l은 파일의 줄(newline) 수를 카운트한다.",
    },
    {
        "category": "file", "difficulty": "medium",
        "title": "{file}을 {dest}로 복사",
        "question": "{file} 파일을 {dest} 디렉터리로 복사하는 명령어를 작성하라.",
        "answer": "cp {file} {dest}/",
        "hint": "cp 명령어로 파일을 다른 디렉터리로 복사할 수 있습니다.",
        "concept": "cp SOURCE DEST/는 파일을 지정한 디렉터리로 복사한다.",
    },
    {
        "category": "file", "difficulty": "hard",
        "title": "{size} 이상 파일 찾기",
        "question": "/var/log 디렉터리에서 {size} 이상인 일반 파일을 모두 찾는 명령어를 작성하라.",
        "answer": "find /var/log -size +{size} -type f",
        "hint": "find 명령어의 -size 옵션에서 + 기호는 '이상'을 의미합니다.",
        "concept": "find -size +N은 N 크기보다 큰 파일을 검색한다. -type f는 일반 파일만 대상으로 한다.",
    },
    {
        "category": "file", "difficulty": "hard",
        "title": "{file} 특정 줄 범위 출력",
        "question": "{file} 파일의 5번째 줄부터 15번째 줄까지만 출력하는 명령어를 작성하라.",
        "answer": "sed -n '5,15p' {file}",
        "hint": "sed의 -n 옵션과 p 커맨드를 조합하여 특정 줄 범위를 출력할 수 있습니다.",
        "concept": "sed -n 'M,Np'는 파일의 M번째부터 N번째 줄까지만 출력하는 스트림 편집 명령이다.",
    },
    {
        "category": "file", "difficulty": "hard",
        "title": "{file}에서 {keyword} 줄만 삭제",
        "question": "{file} 파일에서 '{keyword}'가 포함된 줄을 삭제한 결과를 출력하는 명령어를 작성하라.",
        "answer": "sed '/{keyword}/d' {file}",
        "hint": "sed의 d 커맨드는 해당 패턴과 일치하는 줄을 삭제합니다.",
        "concept": "sed '/PATTERN/d'는 스트림에서 지정한 패턴이 포함된 줄을 삭제하고 나머지를 출력한다.",
    },

    # ═══════════════════════════════════════════════════════════ DIRECTORY ════
    {
        "category": "directory", "difficulty": "easy",
        "title": "현재 위치 확인",
        "question": "현재 작업 디렉터리의 절대 경로를 출력하는 명령어를 작성하라.",
        "answer": "pwd",
        "hint": "Print Working Directory의 약자입니다.",
        "concept": "pwd 명령어는 현재 작업 디렉터리의 절대 경로를 출력한다.",
    },
    {
        "category": "directory", "difficulty": "easy",
        "title": "{dir} 디렉터리 생성",
        "question": "현재 디렉터리에 {dir}라는 이름의 디렉터리를 생성하는 명령어를 작성하라.",
        "answer": "mkdir {dir}",
        "hint": "mkdir(make directory) 명령어를 사용합니다.",
        "concept": "mkdir 명령어는 새로운 디렉터리를 생성한다.",
    },
    {
        "category": "directory", "difficulty": "easy",
        "title": "{dir} 빈 디렉터리 삭제",
        "question": "비어 있는 {dir} 디렉터리를 삭제하는 명령어를 작성하라.",
        "answer": "rmdir {dir}",
        "hint": "rmdir은 빈 디렉터리만 삭제할 수 있습니다.",
        "concept": "rmdir 명령어는 빈 디렉터리를 삭제한다. 내용물이 있으면 실패한다.",
    },
    {
        "category": "directory", "difficulty": "easy",
        "title": "홈 디렉터리로 이동",
        "question": "현재 위치와 관계없이 사용자의 홈 디렉터리로 이동하는 명령어를 작성하라.",
        "answer": "cd ~",
        "hint": "~ 기호는 현재 사용자의 홈 디렉터리를 나타냅니다.",
        "concept": "cd ~ 또는 cd 명령어만 실행하면 홈 디렉터리로 이동한다.",
    },
    {
        "category": "directory", "difficulty": "medium",
        "title": "{dir}/{dir2} 중첩 생성",
        "question": "{dir}/{dir2} 경로의 디렉터리를 중간 디렉터리까지 한 번에 생성하는 명령어를 작성하라.",
        "answer": "mkdir -p {dir}/{dir2}",
        "hint": "mkdir의 -p 옵션을 사용하면 중간 디렉터리도 자동으로 생성됩니다.",
        "concept": "mkdir -p는 경로 중간에 없는 디렉터리까지 재귀적으로 생성한다.",
    },
    {
        "category": "directory", "difficulty": "medium",
        "title": "{dir} 디렉터리 복사",
        "question": "{dir} 디렉터리와 그 하위 내용 전체를 {dir2}로 복사하는 명령어를 작성하라.",
        "answer": "cp -r {dir} {dir2}",
        "hint": "cp 명령어의 -r(recursive) 옵션으로 디렉터리 전체를 복사합니다.",
        "concept": "cp -r은 디렉터리를 재귀적으로 복사한다. 서브디렉터리와 파일 모두 포함된다.",
    },
    {
        "category": "directory", "difficulty": "medium",
        "title": "{dir} 디렉터리 내용 포함 삭제",
        "question": "{dir} 디렉터리와 그 안의 모든 내용을 강제로 삭제하는 명령어를 작성하라.",
        "answer": "rm -rf {dir}",
        "hint": "rm의 -r(recursive), -f(force) 옵션을 조합하세요. 복구 불가능합니다.",
        "concept": "rm -rf는 디렉터리와 그 안의 모든 파일·서브디렉터리를 재귀적으로 강제 삭제한다.",
    },
    {
        "category": "directory", "difficulty": "hard",
        "title": "{dir} 하위 파일 수 세기",
        "question": "{dir} 디렉터리 하위의 모든 파일 개수를 세는 명령어를 작성하라.",
        "answer": "find {dir} -type f | wc -l",
        "hint": "find로 파일 목록을 출력한 뒤 wc -l로 줄 수를 세면 파일 개수가 됩니다.",
        "concept": "find -type f는 일반 파일만 찾는다. 파이프(|)로 wc -l에 전달하면 개수를 셀 수 있다.",
    },
    {
        "category": "directory", "difficulty": "hard",
        "title": "{dir} 용량 확인",
        "question": "{dir} 디렉터리의 전체 디스크 사용량을 사람이 읽기 쉬운 형식으로 출력하는 명령어를 작성하라.",
        "answer": "du -sh {dir}",
        "hint": "du(disk usage)의 -s(summary), -h(human-readable) 옵션을 조합하세요.",
        "concept": "du -sh는 디렉터리의 총 디스크 사용량을 KB/MB/GB 단위로 요약하여 출력한다.",
    },

    # ═══════════════════════════════════════════════════════════ PERMISSION ════
    {
        "category": "permission", "difficulty": "easy",
        "title": "{file} 권한 확인",
        "question": "{file} 파일의 권한을 포함한 상세 정보를 확인하는 명령어를 작성하라.",
        "answer": "ls -l {file}",
        "hint": "ls 명령어의 -l 옵션으로 권한 정보를 확인할 수 있습니다.",
        "concept": "ls -l은 파일의 권한(rwx), 소유자, 그룹, 크기, 수정 시각을 출력한다.",
    },
    {
        "category": "permission", "difficulty": "easy",
        "title": "{file} 권한을 {perm}으로 변경",
        "question": "{file} 파일의 권한을 {perm}으로 변경하는 명령어를 작성하라.",
        "answer": "chmod {perm} {file}",
        "hint": "chmod 명령어는 파일의 읽기/쓰기/실행 권한을 8진수 숫자로 지정합니다.",
        "concept": "chmod로 파일 접근 권한(rwx)을 8진수 숫자로 설정한다. 예: 755 = rwxr-xr-x",
    },
    {
        "category": "permission", "difficulty": "easy",
        "title": "{file} 실행 권한 추가",
        "question": "{file} 파일에 모든 사용자(u/g/o)의 실행 권한을 추가하는 명령어를 작성하라.",
        "answer": "chmod +x {file}",
        "hint": "chmod +x는 기호 방식으로 실행 권한을 추가합니다.",
        "concept": "chmod +x는 소유자·그룹·기타 사용자 모두에게 실행(x) 권한을 추가한다.",
    },
    {
        "category": "permission", "difficulty": "medium",
        "title": "{file} 소유자를 {user}로 변경",
        "question": "{file} 파일의 소유자를 {user}로 변경하는 명령어를 작성하라.",
        "answer": "chown {user} {file}",
        "hint": "chown(change owner) 명령어를 사용합니다. root 권한이 필요합니다.",
        "concept": "chown 명령어는 파일의 소유자를 변경한다. 일반적으로 sudo와 함께 사용한다.",
    },
    {
        "category": "permission", "difficulty": "medium",
        "title": "{file} 소유자·그룹 동시 변경",
        "question": "{file} 파일의 소유자를 {user}, 그룹을 {group}으로 동시에 변경하는 명령어를 작성하라.",
        "answer": "chown {user}:{group} {file}",
        "hint": "chown에서 소유자와 그룹을 콜론(:)으로 구분하여 함께 지정할 수 있습니다.",
        "concept": "chown user:group 형식으로 소유자와 그룹을 한 번에 변경할 수 있다.",
    },
    {
        "category": "permission", "difficulty": "medium",
        "title": "{dir} 그룹을 {group}으로 변경",
        "question": "{dir} 디렉터리의 그룹 소유권을 {group}으로 변경하는 명령어를 작성하라.",
        "answer": "chgrp {group} {dir}",
        "hint": "chgrp(change group) 명령어로 그룹 소유권만 변경할 수 있습니다.",
        "concept": "chgrp GROUP PATH는 파일이나 디렉터리의 그룹 소유권을 변경한다.",
    },
    {
        "category": "permission", "difficulty": "hard",
        "title": "{dir} 하위 파일 권한 일괄 변경",
        "question": "{dir} 디렉터리 하위의 모든 일반 파일 권한을 644로 변경하는 명령어를 작성하라.",
        "answer": "find {dir} -type f -exec chmod 644 {} \\;",
        "hint": "find의 -exec 옵션으로 검색 결과에 명령어를 적용할 수 있습니다. {}는 찾은 파일을 의미합니다.",
        "concept": "find -exec는 검색된 각 파일에 명령어를 실행한다. {}는 현재 파일 경로, \\;는 명령어 끝을 나타낸다.",
    },
    {
        "category": "permission", "difficulty": "hard",
        "title": "SUID 설정 파일 찾기",
        "question": "시스템 전체에서 SUID 비트가 설정된 파일을 모두 찾는 명령어를 작성하라.",
        "answer": "find / -perm -4000 -type f 2>/dev/null",
        "hint": "find의 -perm -4000은 SUID 비트가 설정된 파일을 찾습니다. 2>/dev/null로 오류를 무시합니다.",
        "concept": "SUID(Set User ID) 비트가 설정된 실행 파일은 파일 소유자의 권한으로 실행된다. 보안 감사 시 확인이 필요하다.",
    },

    # ═══════════════════════════════════════════════════════════ PROCESS ════
    {
        "category": "process", "difficulty": "easy",
        "title": "전체 프로세스 확인",
        "question": "현재 실행 중인 모든 프로세스를 상세히 확인하는 명령어를 작성하라.",
        "answer": "ps aux",
        "hint": "ps 명령어에 a(all users), u(user-oriented), x(no terminal) 옵션을 조합하세요.",
        "concept": "ps aux는 시스템의 모든 사용자 프로세스를 상세히 출력한다.",
    },
    {
        "category": "process", "difficulty": "easy",
        "title": "{process} 프로세스 검색",
        "question": "실행 중인 프로세스 목록에서 {process}를 포함한 항목만 필터링하는 명령어를 작성하라.",
        "answer": "ps aux | grep {process}",
        "hint": "ps aux의 출력을 파이프(|)로 grep에 전달하여 특정 이름으로 필터링합니다.",
        "concept": "ps aux | grep PATTERN은 특정 이름의 프로세스만 골라서 보는 기본 패턴이다.",
    },
    {
        "category": "process", "difficulty": "easy",
        "title": "실시간 프로세스 모니터링",
        "question": "CPU 사용량 순으로 정렬된 프로세스 목록을 실시간으로 모니터링하는 명령어를 작성하라.",
        "answer": "top",
        "hint": "top 명령어는 시스템 자원 사용 현황을 실시간으로 보여줍니다.",
        "concept": "top은 CPU, 메모리 등 시스템 자원 현황과 프로세스 목록을 실시간으로 갱신하며 출력한다.",
    },
    {
        "category": "process", "difficulty": "medium",
        "title": "PID {pid} 프로세스 정상 종료",
        "question": "PID가 {pid}인 프로세스에 SIGTERM 신호를 보내 정상 종료하는 명령어를 작성하라.",
        "answer": "kill {pid}",
        "hint": "kill 명령어는 기본적으로 SIGTERM(15) 신호를 보냅니다.",
        "concept": "kill PID는 지정한 프로세스에 SIGTERM을 보내 정상 종료를 요청한다.",
    },
    {
        "category": "process", "difficulty": "medium",
        "title": "{process} 프로세스 강제 종료",
        "question": "{process} 프로세스를 이름으로 찾아 강제 종료(SIGKILL)하는 명령어를 작성하라.",
        "answer": "pkill -9 {process}",
        "hint": "pkill은 프로세스 이름으로 신호를 보냅니다. -9는 SIGKILL입니다.",
        "concept": "pkill -9 NAME은 해당 이름의 모든 프로세스에 SIGKILL을 보내 강제 종료한다.",
    },
    {
        "category": "process", "difficulty": "medium",
        "title": "{process} PID 확인",
        "question": "{process}의 PID만 빠르게 확인하는 명령어를 작성하라.",
        "answer": "pgrep {process}",
        "hint": "pgrep은 프로세스 이름으로 PID를 검색합니다.",
        "concept": "pgrep NAME은 해당 이름의 프로세스 PID를 출력한다.",
    },
    {
        "category": "process", "difficulty": "hard",
        "title": "{port} 포트 사용 프로세스 확인",
        "question": "TCP {port} 포트를 사용하는 프로세스를 확인하는 명령어를 작성하라.",
        "answer": "ss -tlnp | grep :{port}",
        "hint": "ss 명령어의 -t(TCP), -l(listening), -n(numeric), -p(process) 옵션을 조합하세요.",
        "concept": "ss -tlnp는 TCP 리스닝 소켓과 해당 프로세스를 출력한다. grep으로 특정 포트를 필터링한다.",
    },
    {
        "category": "process", "difficulty": "hard",
        "title": "{process} 자식 프로세스 트리 확인",
        "question": "{process}를 포함한 프로세스의 부모-자식 관계를 트리 형태로 보여주는 명령어를 작성하라.",
        "answer": "pstree -p | grep {process}",
        "hint": "pstree는 프로세스를 트리 구조로, -p 옵션은 PID를 함께 출력합니다.",
        "concept": "pstree는 프로세스 계층 구조를 시각적으로 보여준다. -p 옵션으로 각 프로세스의 PID도 표시한다.",
    },

    # ═══════════════════════════════════════════════════════════ NETWORK ════
    {
        "category": "network", "difficulty": "easy",
        "title": "네트워크 인터페이스 확인",
        "question": "현재 시스템의 네트워크 인터페이스 목록과 IP 주소를 확인하는 명령어를 작성하라.",
        "answer": "ip addr",
        "hint": "ip 명령어의 addr 서브커맨드를 사용하세요.",
        "concept": "ip addr 명령어는 네트워크 인터페이스의 IP 주소를 출력한다.",
    },
    {
        "category": "network", "difficulty": "easy",
        "title": "{ip} 연결 확인",
        "question": "{ip} 주소로 4번의 ICMP 패킷을 보내 네트워크 연결을 확인하는 명령어를 작성하라.",
        "answer": "ping -c 4 {ip}",
        "hint": "ping 명령어의 -c 옵션으로 전송 횟수를 지정합니다.",
        "concept": "ping -c N은 N번의 ICMP echo request를 보내 응답을 확인한다.",
    },
    {
        "category": "network", "difficulty": "easy",
        "title": "라우팅 테이블 확인",
        "question": "현재 시스템의 라우팅 테이블을 확인하는 명령어를 작성하라.",
        "answer": "ip route",
        "hint": "ip 명령어의 route 서브커맨드를 사용하세요.",
        "concept": "ip route는 시스템의 라우팅 테이블을 출력한다. 패킷이 어느 경로로 전달될지 확인할 수 있다.",
    },
    {
        "category": "network", "difficulty": "medium",
        "title": "TCP 리스닝 포트 확인",
        "question": "현재 시스템에서 LISTEN 상태인 TCP 포트 목록을 프로세스 정보와 함께 확인하는 명령어를 작성하라.",
        "answer": "ss -tlnp",
        "hint": "ss 명령어의 -t(TCP), -l(listening), -n(숫자), -p(프로세스) 옵션을 조합하세요.",
        "concept": "ss -tlnp는 모든 TCP 리스닝 소켓과 연결된 프로세스 정보를 출력한다.",
    },
    {
        "category": "network", "difficulty": "medium",
        "title": "{ip} 경로 추적",
        "question": "{ip}까지 패킷이 거치는 라우팅 경로를 추적하는 명령어를 작성하라.",
        "answer": "traceroute {ip}",
        "hint": "traceroute 명령어는 목적지까지 거치는 라우터 홉을 출력합니다.",
        "concept": "traceroute는 패킷이 목적지에 도달하기까지 통과하는 네트워크 홉(라우터)을 보여준다.",
    },
    {
        "category": "network", "difficulty": "medium",
        "title": "DNS 조회",
        "question": "google.com 도메인의 IP 주소를 DNS 조회하는 명령어를 작성하라.",
        "answer": "dig google.com",
        "hint": "dig(Domain Information Groper) 명령어로 DNS 조회를 수행합니다.",
        "concept": "dig는 DNS 조회 도구로 도메인의 IP 주소, MX 레코드 등 DNS 정보를 조회한다.",
    },
    {
        "category": "network", "difficulty": "hard",
        "title": "{iface} 패킷 캡처",
        "question": "{iface} 인터페이스에서 포트 {port}의 TCP 패킷을 10개 캡처하는 명령어를 작성하라.",
        "answer": "tcpdump -i {iface} tcp port {port} -c 10",
        "hint": "tcpdump의 -i로 인터페이스, -c로 캡처 수를 지정하고 필터 표현식을 작성합니다.",
        "concept": "tcpdump는 네트워크 패킷을 캡처하는 도구다. -i는 인터페이스, -c는 캡처 수를 지정한다.",
    },
    {
        "category": "network", "difficulty": "hard",
        "title": "{port} 포트 개방 확인",
        "question": "로컬 시스템의 {port} 포트가 열려 있는지 확인하는 명령어를 작성하라.",
        "answer": "nc -zv localhost {port}",
        "hint": "nc(netcat)의 -z(port scan), -v(verbose) 옵션으로 포트 개방 여부를 확인합니다.",
        "concept": "nc -zv HOST PORT는 해당 호스트의 포트에 연결을 시도하여 개방 여부를 확인한다.",
    },

    # ═══════════════════════════════════════════════════════════ PACKAGE ════
    {
        "category": "package", "difficulty": "easy",
        "title": "{package} 설치",
        "question": "apt 패키지 관리자로 {package} 패키지를 설치하는 명령어를 작성하라.",
        "answer": "apt install {package}",
        "hint": "apt 명령어의 install 서브커맨드를 사용하세요.",
        "concept": "apt install은 데비안/우분투 계열에서 패키지를 설치하는 명령어이다.",
    },
    {
        "category": "package", "difficulty": "easy",
        "title": "{package} 제거",
        "question": "apt 패키지 관리자로 {package} 패키지를 제거하는 명령어를 작성하라.",
        "answer": "apt remove {package}",
        "hint": "apt 명령어의 remove 서브커맨드를 사용하세요.",
        "concept": "apt remove는 패키지를 제거하지만 설정 파일은 남긴다. purge는 설정 파일까지 삭제한다.",
    },
    {
        "category": "package", "difficulty": "easy",
        "title": "패키지 목록 업데이트",
        "question": "설치 가능한 패키지 목록을 최신 상태로 갱신하는 명령어를 작성하라.",
        "answer": "apt update",
        "hint": "패키지를 설치하거나 업그레이드하기 전에 항상 패키지 목록을 갱신합니다.",
        "concept": "apt update는 원격 저장소에서 패키지 목록을 내려받아 로컬 캐시를 갱신한다.",
    },
    {
        "category": "package", "difficulty": "medium",
        "title": "{package} 정보 확인",
        "question": "apt로 {package} 패키지의 버전, 설명 등 상세 정보를 확인하는 명령어를 작성하라.",
        "answer": "apt show {package}",
        "hint": "apt 명령어의 show 서브커맨드는 패키지 상세 정보를 출력합니다.",
        "concept": "apt show PACKAGE는 해당 패키지의 버전, 의존성, 설명 등 상세 정보를 출력한다.",
    },
    {
        "category": "package", "difficulty": "medium",
        "title": "{package} 설치 여부 확인",
        "question": "{package} 패키지가 현재 시스템에 설치되어 있는지 확인하는 명령어를 작성하라.",
        "answer": "dpkg -l {package}",
        "hint": "dpkg 명령어의 -l 옵션은 패키지 설치 목록을 출력합니다.",
        "concept": "dpkg -l PACKAGE는 해당 패키지의 설치 상태(ii: 설치됨, rc: 제거됨 등)를 보여준다.",
    },
    {
        "category": "package", "difficulty": "hard",
        "title": "{package} 소유 파일 목록",
        "question": "설치된 {package} 패키지가 어떤 파일들을 포함하는지 확인하는 명령어를 작성하라.",
        "answer": "dpkg -L {package}",
        "hint": "dpkg 명령어의 -L 옵션은 패키지에 포함된 파일 목록을 출력합니다.",
        "concept": "dpkg -L PACKAGE는 해당 패키지가 설치한 모든 파일 경로를 나열한다.",
    },
    {
        "category": "package", "difficulty": "hard",
        "title": "{file} 소유 패키지 확인",
        "question": "/usr/bin/{file} 파일을 설치한 패키지를 확인하는 명령어를 작성하라.",
        "answer": "dpkg -S /usr/bin/{file}",
        "hint": "dpkg -S는 파일 경로로 어떤 패키지가 그 파일을 설치했는지 역으로 찾습니다.",
        "concept": "dpkg -S FILE은 해당 파일을 설치한 패키지를 역으로 조회한다.",
    },

    # ═══════════════════════════════════════════════════════════ SERVICE ════
    {
        "category": "service", "difficulty": "easy",
        "title": "{service} 상태 확인",
        "question": "{service} 서비스의 현재 상태를 확인하는 명령어를 작성하라.",
        "answer": "systemctl status {service}",
        "hint": "systemctl 명령어의 status 서브커맨드를 사용하세요.",
        "concept": "systemctl status는 systemd 서비스의 현재 상태(실행 중, 중지 등)를 출력한다.",
    },
    {
        "category": "service", "difficulty": "easy",
        "title": "{service} 시작",
        "question": "중지되어 있는 {service} 서비스를 즉시 시작하는 명령어를 작성하라.",
        "answer": "systemctl start {service}",
        "hint": "systemctl 명령어의 start 서브커맨드를 사용하세요.",
        "concept": "systemctl start SERVICE는 해당 서비스를 즉시 시작한다.",
    },
    {
        "category": "service", "difficulty": "easy",
        "title": "{service} 중지",
        "question": "실행 중인 {service} 서비스를 중지하는 명령어를 작성하라.",
        "answer": "systemctl stop {service}",
        "hint": "systemctl 명령어의 stop 서브커맨드를 사용하세요.",
        "concept": "systemctl stop SERVICE는 실행 중인 서비스를 중지한다.",
    },
    {
        "category": "service", "difficulty": "medium",
        "title": "{service} 재시작",
        "question": "설정 변경 후 {service} 서비스를 재시작하는 명령어를 작성하라.",
        "answer": "systemctl restart {service}",
        "hint": "restart는 서비스를 중지했다가 다시 시작합니다.",
        "concept": "systemctl restart는 서비스를 중지하고 즉시 다시 시작한다. 설정 변경 적용 시 사용한다.",
    },
    {
        "category": "service", "difficulty": "medium",
        "title": "{service} 부팅 자동 시작",
        "question": "시스템 부팅 시 {service} 서비스가 자동으로 시작되도록 설정하는 명령어를 작성하라.",
        "answer": "systemctl enable {service}",
        "hint": "systemctl 명령어의 enable 서브커맨드를 사용하세요.",
        "concept": "systemctl enable은 서비스를 부팅 시 자동 시작되도록 심볼릭 링크를 생성한다.",
    },
    {
        "category": "service", "difficulty": "medium",
        "title": "{service} 설정 리로드",
        "question": "{service}를 중단하지 않고 설정 파일만 다시 불러오는 명령어를 작성하라.",
        "answer": "systemctl reload {service}",
        "hint": "reload는 서비스를 중단하지 않고 설정만 갱신합니다. restart와 차이가 있습니다.",
        "concept": "systemctl reload는 서비스 프로세스를 유지하면서 설정만 다시 로드한다. 무중단 반영이 가능하다.",
    },
    {
        "category": "service", "difficulty": "hard",
        "title": "{service} 로그 확인",
        "question": "{service} 서비스의 최근 50줄 로그를 확인하는 명령어를 작성하라.",
        "answer": "journalctl -u {service} -n 50 --no-pager",
        "hint": "journalctl의 -u 옵션으로 특정 유닛 로그를 보고, -n으로 출력 줄 수를 지정합니다.",
        "concept": "journalctl -u SERVICE는 systemd 저널에서 특정 서비스의 로그를 조회한다.",
    },
    {
        "category": "service", "difficulty": "hard",
        "title": "전체 서비스 목록 확인",
        "question": "systemd로 관리되는 모든 서비스의 상태를 목록으로 확인하는 명령어를 작성하라.",
        "answer": "systemctl list-units --type=service",
        "hint": "systemctl의 list-units 서브커맨드에 --type=service 옵션을 추가하세요.",
        "concept": "systemctl list-units --type=service는 로드된 모든 서비스 유닛과 상태를 출력한다.",
    },

    # ═══════════════════════════════════════════════════════════ SEARCH ════
    {
        "category": "search", "difficulty": "easy",
        "title": "{file}에서 {keyword} 검색",
        "question": "{file} 파일에서 '{keyword}'가 포함된 줄을 모두 출력하는 명령어를 작성하라.",
        "answer": "grep '{keyword}' {file}",
        "hint": "grep 명령어는 파일에서 패턴을 검색합니다.",
        "concept": "grep은 파일에서 지정한 문자열 패턴과 일치하는 줄을 출력하는 도구이다.",
    },
    {
        "category": "search", "difficulty": "easy",
        "title": "{keyword} 대소문자 무시 검색",
        "question": "{file} 파일에서 '{keyword}'를 대소문자 구분 없이 검색하는 명령어를 작성하라.",
        "answer": "grep -i '{keyword}' {file}",
        "hint": "grep의 -i 옵션은 대소문자를 구분하지 않고 검색합니다.",
        "concept": "grep -i는 대소문자를 구분하지 않는 검색을 수행한다.",
    },
    {
        "category": "search", "difficulty": "medium",
        "title": "{keyword} 재귀 검색",
        "question": "현재 디렉터리와 하위 디렉터리에서 '{keyword}'를 포함한 파일과 줄 번호를 출력하는 명령어를 작성하라.",
        "answer": "grep -rn '{keyword}' .",
        "hint": "grep의 -r(recursive), -n(line number) 옵션을 조합하세요.",
        "concept": "grep -rn은 디렉터리를 재귀적으로 탐색하며 패턴을 검색하고, 줄 번호를 함께 출력한다.",
    },
    {
        "category": "search", "difficulty": "medium",
        "title": "{keyword} 없는 줄 출력",
        "question": "{file} 파일에서 '{keyword}'가 포함되지 않은 줄만 출력하는 명령어를 작성하라.",
        "answer": "grep -v '{keyword}' {file}",
        "hint": "grep의 -v 옵션은 패턴과 일치하지 않는 줄을 출력합니다.",
        "concept": "grep -v는 지정한 패턴과 일치하지 않는 줄만 출력하는 반전(invert) 검색이다.",
    },
    {
        "category": "search", "difficulty": "medium",
        "title": "{keyword} 포함 파일만 출력",
        "question": "현재 디렉터리에서 '{keyword}'를 포함하는 파일의 이름만 출력하는 명령어를 작성하라.",
        "answer": "grep -rl '{keyword}' .",
        "hint": "grep -l 옵션은 일치하는 줄 대신 파일 이름만 출력합니다.",
        "concept": "grep -rl은 패턴을 포함하는 파일의 경로만 출력한다. 대규모 코드베이스에서 유용하다.",
    },
    {
        "category": "search", "difficulty": "hard",
        "title": "{keyword} 포함 파일명 찾기",
        "question": "/etc 디렉터리에서 이름에 '{keyword}'가 포함된 파일을 모두 찾는 명령어를 작성하라.",
        "answer": "find /etc -name '*{keyword}*' -type f",
        "hint": "find 명령어의 -name 옵션에 와일드카드(*)를 사용하세요.",
        "concept": "find -name '*PATTERN*'은 파일명에 특정 문자열이 포함된 파일을 재귀적으로 찾는다.",
    },
    {
        "category": "search", "difficulty": "hard",
        "title": "{keyword} 전후 문맥 출력",
        "question": "{file} 파일에서 '{keyword}'를 검색하고 일치한 줄 위아래 3줄씩 함께 출력하는 명령어를 작성하라.",
        "answer": "grep -C 3 '{keyword}' {file}",
        "hint": "grep의 -C N 옵션은 일치한 줄 전후 N줄의 문맥을 함께 출력합니다.",
        "concept": "grep -C N은 일치하는 줄의 전후 N줄을 함께 출력하여 문맥 파악을 돕는다.",
    },

    # ═══════════════════════════════════════════════════════ COMPRESSION ════
    {
        "category": "compression", "difficulty": "easy",
        "title": "{archive} 압축 해제",
        "question": "{archive} 파일을 현재 디렉터리에 압축 해제하는 명령어를 작성하라.",
        "answer": "tar -xzf {archive}",
        "hint": "tar 명령어에서 x(extract), z(gzip), f(file) 옵션을 조합하세요.",
        "concept": "tar -xzf는 gzip으로 압축된 tar 아카이브를 현재 위치에 풀어낸다.",
    },
    {
        "category": "compression", "difficulty": "easy",
        "title": "{dir} 디렉터리 tar.gz 압축",
        "question": "{dir} 디렉터리 전체를 {dir}.tar.gz로 압축하는 명령어를 작성하라.",
        "answer": "tar -czf {dir}.tar.gz {dir}",
        "hint": "tar 명령어에서 c(create), z(gzip), f(file) 옵션을 조합하세요.",
        "concept": "tar -czf는 디렉터리를 gzip으로 압축하여 .tar.gz 아카이브를 생성한다.",
    },
    {
        "category": "compression", "difficulty": "medium",
        "title": "{archive} 내용 목록 확인",
        "question": "{archive} 파일의 내용 목록을 압축 해제 없이 확인하는 명령어를 작성하라.",
        "answer": "tar -tzf {archive}",
        "hint": "tar의 -t(list) 옵션은 아카이브 내용을 보여줍니다.",
        "concept": "tar -tzf는 gzip 압축 아카이브의 파일 목록을 풀지 않고 출력한다.",
    },
    {
        "category": "compression", "difficulty": "medium",
        "title": "{file} gzip 압축",
        "question": "{file} 파일을 gzip으로 압축하는 명령어를 작성하라.",
        "answer": "gzip {file}",
        "hint": "gzip 명령어는 파일을 압축하고 원본 파일을 .gz 파일로 대체합니다.",
        "concept": "gzip 명령어는 파일을 gzip 포맷으로 압축한다. 원본 파일은 .gz 파일로 교체된다.",
    },
    {
        "category": "compression", "difficulty": "medium",
        "title": "{archive} 특정 디렉터리에 해제",
        "question": "{archive} 파일을 {dest} 디렉터리 안에 압축 해제하는 명령어를 작성하라.",
        "answer": "tar -xzf {archive} -C {dest}",
        "hint": "tar의 -C 옵션으로 압축 해제할 대상 디렉터리를 지정합니다.",
        "concept": "tar -xzf ARCHIVE -C DEST는 아카이브를 지정한 디렉터리에 압축 해제한다.",
    },
    {
        "category": "compression", "difficulty": "hard",
        "title": "{archive}에서 {file}만 추출",
        "question": "{archive}에서 {file} 파일만 현재 디렉터리로 추출하는 명령어를 작성하라.",
        "answer": "tar -xzf {archive} {file}",
        "hint": "tar 압축 해제 시 파일명을 지정하면 해당 파일만 추출할 수 있습니다.",
        "concept": "tar -xzf ARCHIVE FILE은 아카이브에서 특정 파일만 선택적으로 추출한다.",
    },
    {
        "category": "compression", "difficulty": "hard",
        "title": "{dir} bzip2 압축",
        "question": "{dir} 디렉터리를 bzip2 방식으로 압축하여 {dir}.tar.bz2 파일을 생성하는 명령어를 작성하라.",
        "answer": "tar -cjf {dir}.tar.bz2 {dir}",
        "hint": "tar의 -j 옵션은 bzip2 압축을 사용합니다.",
        "concept": "tar -cjf는 bzip2 압축을 사용하여 아카이브를 생성한다. gzip보다 압축률이 높지만 느리다.",
    },

    # ═══════════════════════════════════════════════════════ ENVIRONMENT ════
    {
        "category": "environment", "difficulty": "easy",
        "title": "PATH 환경변수 출력",
        "question": "현재 쉘 세션의 PATH 환경변수 값을 출력하는 명령어를 작성하라.",
        "answer": "echo $PATH",
        "hint": "echo 명령어와 $ 기호로 환경변수를 참조하세요.",
        "concept": "echo $변수명은 환경변수의 현재 값을 표준 출력으로 출력한다.",
    },
    {
        "category": "environment", "difficulty": "easy",
        "title": "{env_var} 환경변수 출력",
        "question": "현재 쉘의 {env_var} 환경변수 값을 출력하는 명령어를 작성하라.",
        "answer": "echo ${env_var}",
        "hint": "환경변수는 $ 기호 뒤에 변수 이름을 붙여서 참조합니다.",
        "concept": "echo $VAR는 해당 환경변수의 값을 출력한다.",
    },
    {
        "category": "environment", "difficulty": "easy",
        "title": "전체 환경변수 확인",
        "question": "현재 쉘 세션의 모든 환경변수를 확인하는 명령어를 작성하라.",
        "answer": "env",
        "hint": "env 명령어는 모든 환경변수를 출력합니다.",
        "concept": "env 명령어는 현재 세션에 설정된 모든 환경변수를 출력한다.",
    },
    {
        "category": "environment", "difficulty": "medium",
        "title": "{env_var} 환경변수 설정",
        "question": "현재 쉘 세션에서 {env_var}=test_value 환경변수를 설정하고 자식 프로세스에 전달하는 명령어를 작성하라.",
        "answer": "export {env_var}=test_value",
        "hint": "export 명령어는 변수를 환경변수로 선언하여 자식 프로세스에 전달합니다.",
        "concept": "export VAR=VALUE는 해당 변수를 환경변수로 설정하여 현재 세션과 자식 프로세스에 적용한다.",
    },
    {
        "category": "environment", "difficulty": "medium",
        "title": "{env_var} 환경변수 삭제",
        "question": "현재 쉘 세션에서 {env_var} 환경변수를 삭제하는 명령어를 작성하라.",
        "answer": "unset {env_var}",
        "hint": "unset 명령어로 환경변수를 삭제할 수 있습니다.",
        "concept": "unset VAR는 해당 환경변수를 현재 쉘 세션에서 제거한다.",
    },
    {
        "category": "environment", "difficulty": "hard",
        "title": "{env_var} 영구 설정",
        "question": "{env_var}=production을 모든 bash 세션에 영구 적용되도록 ~/.bashrc에 추가하는 명령어를 작성하라.",
        "answer": "echo 'export {env_var}=production' >> ~/.bashrc",
        "hint": ">>는 파일에 내용을 추가(append)합니다. ~/.bashrc는 bash 시작 시 자동으로 로드됩니다.",
        "concept": "~/.bashrc에 export 구문을 추가하면 새로운 bash 세션마다 해당 환경변수가 자동으로 설정된다.",
    },
    {
        "category": "environment", "difficulty": "hard",
        "title": "환경변수 적용",
        "question": "~/.bashrc 파일에 추가한 설정을 현재 쉘 세션에 즉시 적용하는 명령어를 작성하라.",
        "answer": "source ~/.bashrc",
        "hint": "source 명령어(또는 .으로도 가능)로 파일을 현재 쉘에서 실행합니다.",
        "concept": "source ~/.bashrc는 .bashrc를 현재 쉘에서 재실행하여 변경 사항을 즉시 적용한다.",
    },
]


# ── Difficulty normalisation ──────────────────────────────────────────────────

def _normalise_difficulty(difficulty: str) -> str:
    """Map 'beginner' → 'easy' so the pool lookup succeeds."""
    return "easy" if difficulty == "beginner" else difficulty


# ── Public API ────────────────────────────────────────────────────────────────

def generate_from_templates(category: str, difficulty: str, count: int) -> list[dict]:
    """Return *count* problems from the variable-substitution template pool.

    Fallback order (first non-empty pool wins):
      1. Exact match  — same category AND same difficulty
      2. Same category, any difficulty
      3. Same difficulty, any category
      4. Entire _POOL
      5. _HARDCODED list (absolute minimum, cannot be empty)

    Each problem is generated by substituting fresh random values into the
    template's {PLACEHOLDER} tokens, so repeated calls produce unique-looking
    problems even when the same template is picked multiple times.
    """
    lookup_diff = _normalise_difficulty(difficulty)

    # Level 1 – exact match
    pool = [t for t in _POOL if t["category"] == category and t["difficulty"] == lookup_diff]

    # Level 2 – same category, any difficulty
    if not pool:
        pool = [t for t in _POOL if t["category"] == category]

    # Level 3 – same difficulty, any category
    if not pool:
        pool = [t for t in _POOL if t["difficulty"] == lookup_diff]

    # Level 4 – entire pool
    if not pool:
        pool = list(_POOL)

    # Level 5 – absolute hardcoded minimum (cannot be empty)
    if not pool:
        pool = list(_HARDCODED)

    # Pick templates (with replacement when count > pool size)
    picks = (
        random.choices(pool, k=count)
        if count > len(pool)
        else random.sample(pool, k=count)
    )

    out: list[dict] = []
    for tmpl in picks:
        row = _fill(tmpl)
        # Stamp the requested category/difficulty (pool item may be from a fallback)
        row["category"] = category
        row["difficulty"] = difficulty
        out.append(row)

    return out


# ── Absolute hardcoded minimum ────────────────────────────────────────────────
# Used only when _POOL is somehow empty. Should never be reached in practice.

_HARDCODED: list[dict] = [
    {
        "title": "숨김 파일 포함 목록 확인",
        "category": "file",
        "difficulty": "easy",
        "question": "현재 디렉터리의 모든 파일(숨김 파일 포함)을 상세 목록으로 출력하는 명령어를 작성하라.",
        "answer": "ls -la",
        "hint": "ls 명령어의 -a(all)와 -l(long) 옵션을 조합하세요.",
        "concept": "ls -la는 .으로 시작하는 숨김 파일까지 포함하여 권한, 소유자 등의 상세 정보를 출력한다.",
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
        "title": "전체 프로세스 확인",
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
        "title": "환경변수 출력",
        "category": "environment",
        "difficulty": "easy",
        "question": "현재 쉘 세션의 PATH 환경변수 값을 출력하는 명령어를 작성하라.",
        "answer": "echo $PATH",
        "hint": "echo 명령어와 $ 기호로 환경변수를 참조하세요.",
        "concept": "echo $변수명은 환경변수의 현재 값을 표준 출력으로 출력한다.",
    },
]

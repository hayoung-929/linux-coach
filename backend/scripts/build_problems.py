"""One-off generator: writes data/bulk_problems.json (90 curated-style items). Run from repo root: python backend/scripts/build_problems.py"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "bulk_problems.json"


def main() -> None:
    problems: list[dict] = []
    cats = [
        "file",
        "directory",
        "permission",
        "process",
        "network",
        "package",
        "service",
        "search",
        "compression",
        "environment",
    ]
    diffs = ["easy", "medium", "hard"]

    # Three distinct stems per (category, difficulty) => 10*3*3 = 90
    stems: dict[tuple[str, str], list[tuple[str, str, list[str] | str, str, str]]] = {}

    def stem(
        cat: str,
        diff: str,
        title: str,
        q: str,
        ans: list[str] | str,
        hint: str,
        concept: str,
    ) -> None:
        stems.setdefault((cat, diff), []).append((title, q, ans, hint, concept))

    # ── file ─────────────────────────────────────────────────────────────
    stem("file", "easy", "현재 디렉터리 전체(숨김 포함) 나열", "현재 작업 디렉터리의 모든 항목을 숨김 파일까지 포함해 자세히 나열하는 명령은?", ["ls -la", "ls -al"], "`.` 와 `..`도 함께 보입니다. 긴 옵션과 짧은 옵션 조합을 생각해 보세요.", "ls -a는 숨김, -l은 상세 형식이다.")
    stem("file", "easy", "빈 파일 만들기", "/tmp/foo.txt 가 없을 때 크기 0인 파일을 만드는 한 줄 명령은?", ["touch /tmp/foo.txt"], "`touch`는 타임스탬프를 갱신하며 없으면 빈 파일을 만듭니다.", "touch는 비존재 파일을 0바이트로 생성한다.")
    stem("file", "easy", "파일 내용 앞부분 보기", "/var/log/syslog 의 처음 20줄만 출력하는 명령은?", ["head -n 20 /var/log/syslog", "head -20 /var/log/syslog"], "스트림의 앞부분만 자르는 명령이 있습니다.", "head는 파일 앞부분 줄을 출력한다.")
    stem("file", "medium", "심볼릭 링크 생성", "/etc/nginx/sites-enabled/default 가 /etc/nginx/sites-available/default 를 가리키도록 상대·절대 모두 가능한 심볼릭 링크 한 줄은?", ["ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default"], "`ln`의 소프트 링크 옵션을 확인하세요.", "ln -s target linkname 형식으로 심볼릭 링크를 만든다.")
    stem("file", "medium", "파일 이름 변경", "/tmp/a.txt 를 /tmp/b.txt 로 이름만 바꾸는 한 줄은?", ["mv /tmp/a.txt /tmp/b.txt"], "같은 파티션에서는 메타데이터만 바뀌는 경우가 많습니다.", "mv는 이동과 동시에 이름 변경에 쓰인다.")
    stem("file", "medium", "빈 디렉터리 삭제", "/tmp/empty_dir 가 비어 있을 때 디렉터리만 제거하는 명령은?", ["rmdir /tmp/empty_dir"], "비어 있지 않으면 실패하는 명령이 있습니다.", "rmdir는 빈 디렉터리만 삭제한다.")
    stem("file", "hard", "inode 하드링크", "/data/orig.bin 과 동일 inode를 공유하는 /backup/mirror.bin 을 만드는 명령은?", ["ln /data/orig.bin /backup/mirror.bin"], "심볼릭이 아닌 동일 inode 링크입니다.", "하드링크는 ln 대상이 존재하는 일반 파일이어야 한다.")
    stem("file", "hard", "대용량 파일 일부만 복사", "dd 로 /dev/zero 에서 1MiB 블록을 /tmp/blob.bin 에 쓰는 예시 한 줄을 작성하라 (count=1).", ["dd if=/dev/zero of=/tmp/blob.bin bs=1M count=1"], "if, of, bs, count 키워드를 사용합니다.", "dd는 블록 단위 복사·생성에 쓰인다.")
    stem("file", "hard", "ACL 읽기", "file.txt 의 ACL을 사람이 읽기 쉬운 형태로 출력하는 명령은?", ["getfacl file.txt"], "POSIX ACL 조회 도구입니다.", "getfacl은 파일/디렉터리의 ACL을 출력한다.")

    # ── directory ─────────────────────────────────────────────────────
    stem("directory", "easy", "하위까지 디렉터리 생성", "/var/www/site/assets 가 없을 때 중간 경로까지 한 번에 만드는 명령은?", ["mkdir -p /var/www/site/assets"], "부모가 없으면 실패하는 기본 mkdir과 달리 `-p`가 있습니다.", "mkdir -p는 필요한 상위 디렉터리까지 생성한다.")
    stem("directory", "easy", "현재 위치 확인", "셸에서 현재 작업 디렉터리 절대 경로를 출력하는 명령은?", ["pwd"], "프롬프트만 보지 말고 표준 출력으로 찍는 명령입니다.", "pwd는 현재 작업 디렉터리를 출력한다.")
    stem("directory", "easy", "빈 디렉터리 나열", "/tmp 아래에서 빈 디렉터리만 찾는 것은 어렵지만, `/tmp` 바로 아래 항목만 나열하는 명령은?", ["ls -1 /tmp", "ls /tmp"], "한 컬럼/간단 목록 옵션을 떠올려 보세요.", "ls는 디렉터리 내용을 나열한다.")
    stem("directory", "medium", "트리 구조 출력", "/etc/nginx 디렉터리 구조를 2단계까지만 보여 주는 명령은?", ["tree -L 2 /etc/nginx"], "`tree`가 없을 수도 있으나 문제는 tree 사용을 전제로 합니다.", "tree -L로 깊이를 제한한다.")
    stem("directory", "medium", "작업 디렉터리 이동", "사용자 홈으로 이동하는 가장 짧은 cd 형태는?", ["cd ~", "cd"], "`HOME`을 쓰는 표기와 인자 없는 cd를 비교해 보세요.", "cd ~ 또는 단독 cd는 홈으로 이동한다.")
    stem("directory", "medium", "퍼미션과 함께 디렉터리 나열", "/var/log 디렉터리의 항목을 상세 퍼미션과 함께 시간순으로 보는 명령은?", ["ls -lt /var/log", "ls -tl /var/log"], "정렬과 long 옵션 조합입니다.", "ls -lt는 수정 시각 기준 정렬+상세.")
    stem("directory", "hard", "find 로 디렉터리만", "/var 아래에서 디렉터리 타입만 찾아 경로를 출력하는 find 예시를 작성하라.", ["find /var -type d"], "타입 필터 옵션을 사용합니다.", "find -type d는 디렉터리만 찾는다.")
    stem("directory", "hard", "sticky bit 디렉터리", "/shared 를 모두 rwx + sticky 로 설정하는 chmod 숫자 한 줄은?", ["chmod 1777 /shared"], "특수 비트가 앞에 붙는 네 자리 표기입니다.", "1777은 sticky + rwxrwxrwx.")
    stem("directory", "hard", "bind mount", "이미 존재하는 /data 를 /mnt/data 에 바인드 마운트하는 mount 한 줄을 작성하라.", ["mount --bind /data /mnt/data", "mount -o bind /data /mnt/data"], "`--bind` 또는 `-o bind`입니다.", "bind mount는 동일 트리를 다른 위치에 붙인다.")

    # ── permission ─────────────────────────────────────────────────────
    stem("permission", "easy", "소유자만 읽기 쓰기", "secret.txt 에 대해 소유자만 rw-, 나머지는 --- 인 숫자 모드는?", ["chmod 600 secret.txt"], "u=6, g=0, o=0 입니다.", "600은 소유자 읽기/쓰기만.")
    stem("permission", "easy", "실행 비트 추가", "script.sh 에 모든 사용자 실행 비트를 추가(기존 r/w 유지)하는 한 줄은?", ["chmod a+x script.sh", "chmod +x script.sh"], "기호 모드에서 a 또는 ugo에 x를 더합니다.", "chmod +x는 실행 비트를 추가한다.")
    stem("permission", "easy", "디렉터리 기본 퍼미션", "umask 022 일 때 새 파일이 644가 되는 이유를 설명하는 대신, umask 값을 027로 설정하는 한 줄은?", ["umask 027"], "셸 빌트인입니다.", "umask는 새 파일/디렉터리의 기본 권한을 줄인다.")
    stem("permission", "medium", "setgid 디렉터리", "팀 공유 디렉터리 /srv/project 에 setgid 가 걸리도록 숫자 chmod 한 줄은?", ["chmod 2775 /srv/project"], "setgid 비트는 g+s 또는 2xxx 입니다.", "2775는 setgid+rwxrwxr-x.")
    stem("permission", "medium", "ACL 기본 부여", "dir/ 에 대해 기본 ACL로 group:dev 에 r-x 를 주는 setfacl 한 줄은?", ["setfacl -d -m g:dev:r-x dir/"], "default ACL 옵션을 찾아보세요.", "setfacl -d는 하위 객체에 상속될 기본 ACL을 설정한다.")
    stem("permission", "medium", "소유자 일괄 변경", "/var/www 하위 모든 파일의 소유자를 www-data 로 재귀 변경하는 chown 한 줄은?", ["chown -R www-data:www-data /var/www"], "재귀 옵션을 사용합니다.", "chown -R은 트리 전체 소유자를 바꾼다.")
    stem("permission", "hard", "특수비트 제거", "setuid 가 붙은 /usr/bin/foo 에서 setuid 만 떼고 실행 비트는 유지하려면?", ["chmod u-s /usr/bin/foo"], "u+s / u-s 기호 모드입니다.", "chmod u-s는 setuid 비트를 제거한다.")
    stem("permission", "hard", "sticky 제거", "/tmp 의 sticky 비트를 제거하는 chmod 한 줄은?", ["chmod o-t /tmp", "chmod -t /tmp"], "o-t 또는 -t 표기를 사용합니다.", "o-t는 sticky 비트를 뺀다.")
    stem("permission", "hard", "capability (개념)", "/bin/ping 에 cap_net_raw+ep 를 부여하는 setcap 한 줄을 작성하라.", ["setcap cap_net_raw+ep /bin/ping"], "setcap 문법을 맞추세요.", "setcap은 파일에 POSIX capability를 붙인다.")

    # ── process ────────────────────────────────────────────────────────
    stem("process", "easy", "bash 프로세스 찾기", "명령줄에 bash 가 포함된 프로세스만 pgrep 으로 PID 출력", ["pgrep -f bash", "pgrep bash"], "-f 옵션의 의미를 확인하세요.", "pgrep은 패턴에 맞는 PID를 출력한다.")
    stem("process", "easy", "부모 PID", "PID 4321 프로세스의 부모 PID만 출력하는 ps 형식 한 줄", ["ps -o ppid= -p 4321"], "커스텀 출력 필드와 PID 필터입니다.", "ps -o ppid= -p pid는 부모 PID만 출력.")
    stem("process", "easy", "백그라운드 실행", "sleep 100 을 백그라운드로 실행하고 셸 프롬프트를 바로 돌려받는 한 줄", ["sleep 100 &"], "셸 작업 제어 기호입니다.", "&는 백그라운드 실행.")
    stem("process", "medium", "nice 로 낮은 우선순위", "command.sh 를 낮은 우선순위(nice +10)로 실행", ["nice -n 10 ./command.sh"], "nice의 숫자 옵션 형식을 확인하세요.", "nice -n은 우선순위 조정 실행.")
    stem("process", "medium", "CPU 상위 프로세스", "1회 스냅샷에서 CPU% 상위 5개 프로세스만 보고 싶다면 ps 와 head 조합 예시를 작성하라.", ["ps aux --sort=-%cpu | head -n 6"], "헤더 1줄 + 5프로세스가 되도록 head 개수를 조절합니다.", "파이프로 ps 출력을 자릅니다.")
    stem("process", "medium", "좀비 확인 개념", "defunct 상태 문자가 있는지 ps 출력에서 찾는 grep 한 줄", ["ps aux | grep defunct"], "간단한 텍스트 필터입니다.", "grep으로 ps 출력을 필터링한다.")
    stem("process", "hard", "cgroup 내 프로세스", "PID 999 의 cgroup 경로를 확인하는 한 줄(리눅스 일반 경로)", ["cat /proc/999/cgroup"], "/proc 파일시스템입니다.", "/proc/pid/cgroup은 cgroup 멤버십을 보여준다.")
    stem("process", "hard", "rlimit 확인", "PID 1 의 Max open files 소프트 한도를 보는 명령 예시", ["cat /proc/1/limits"], "limits 파일을 읽습니다.", "/proc/pid/limits는 rlimit 테이블이다.")
    stem("process", "hard", "프로세스 트리", "PID 1 을 루트로 프로세스 트리를 보여 주는 pstree 한 줄", ["pstree -p 1"], "PID 표시 옵션을 포함합니다.", "pstree는 부모-자식 관계를 트리로 출력한다.")

    # ── network ─────────────────────────────────────────────────────────
    stem("network", "easy", "로컬호스트 포트 점검", "127.0.0.1:8080 이 열려 있는지 nc 로 검사하는 한 줄", ["nc -zv 127.0.0.1 8080", "nc -z 127.0.0.1 8080"], "zero-I/O 스캔 옵션입니다.", "nc -z는 포트 스캔 모드.")
    stem("network", "easy", "DNS 조회", "example.com 의 A 레코드를 조회하는 dig 한 줄", ["dig +short example.com A", "dig example.com A +short"], "짧은 출력 옵션을 사용합니다.", "dig는 DNS 질의 도구.")
    stem("network", "easy", "라우팅 테이블", "IPv4 라우팅 테이블을 보는 ip 명령 한 줄", ["ip -4 route show", "ip route"], "주소 패밀리 필터와 route 객체입니다.", "ip route는 라우팅 테이블을 출력한다.")
    stem("network", "medium", "ss 로 UDP", "UDP 소켓 중 LISTEN 상태를 숫자로 보여 주는 ss 한 줄", ["ss -lun"], "UDP + listen + numeric 옵션 조합입니다.", "ss -lun은 UDP LISTEN을 숫자 주소로.")
    stem("network", "medium", "curl POST JSON", "https://api.example.com/v1/ping 에 JSON {\"ok\":true} POST (Content-Type 포함) curl 한 줄", ['curl -sS -H "Content-Type: application/json" -d \'{"ok":true}\' https://api.example.com/v1/ping'], "헤더와 데이터 바디를 모두 지정합니다.", "curl -H와 -d로 JSON POST.")
    stem("network", "medium", "wget 재시도", "대용량 파일을 wget 으로 받되 타임아웃 30초·재시도 3회 옵션을 포함한 한 줄", ["wget -T 30 -t 3 https://example.com/big.bin"], "대문자 T와 소문자 t의 의미를 구분하세요.", "wget -T는 타임아웃, -t는 재시도 횟수.")
    stem("network", "hard", "tc qdisc 보기", "eth0 큐 규칙을 보는 tc 한 줄", ["tc qdisc show dev eth0"], "`qdisc` 서브커맨드입니다.", "tc는 트래픽 제어를 다룬다.")
    stem("network", "hard", "mtr 한 번", "example.com 에 대해 mtr 을 리포트 10회로 제한하는 한 줄", ["mtr -rwzc 10 example.com"], "옵션 조합은 배포판마다 다를 수 있으나 보고서 모드를 전제로 합니다.", "mtr은 경로 진단 도구.")
    stem("network", "hard", "iptables 규칙 번호", "filter 테이블 INPUT 체인 규칙을 번호와 함께 보는 iptables 한 줄", ["iptables -L INPUT -n --line-numbers"], "line-numbers 옵션입니다.", "iptables --line-numbers는 규칙 인덱스를 표시한다.")

    # ── package ─────────────────────────────────────────────────────────
    stem("package", "easy", "패키지 검색", "Debian 계열에서 nginx 관련 패키지 이름을 검색하는 apt 한 줄", ["apt search nginx"], "텍스트 검색이 아닌 패키지 인덱스 검색입니다.", "apt search는 패키지 메타데이터를 검색한다.")
    stem("package", "easy", "설치된 버전", "설치된 openssl 패키지 버전을 보여 주는 dpkg 한 줄", ["dpkg -l openssl"], "리스트에서 특정 패키지를 찾습니다.", "dpkg -l은 설치된 패키지 상태를 보여준다.")
    stem("package", "easy", "캐시 업데이트", "패키지 목록만 최신화하고 설치는 하지 않는 apt 한 줄", ["apt update"], "upgrade와 혼동하지 마세요.", "apt update는 인덱스만 갱신한다.")
    stem("package", "medium", "의존성 역추적", "libssl 패키지를 설치한 패키지를 보고 싶다면 apt-cache 또는 apt 중 하나로 한 줄", ["apt-cache rdepends libssl3", "apt rdepends libssl3"], "배포판에 따라 명령이 다를 수 있습니다.", "rdepends는 역의존성을 조회한다.")
    stem("package", "medium", "hold 설정", "nginx 패키지를 apt 에서 업그레이드되지 않게 hold 하는 한 줄", ["apt-mark hold nginx"], "hold 마크 도구입니다.", "apt-mark hold은 자동 업그레이드에서 제외한다.")
    stem("package", "medium", "autoremove", "더 이상 필요 없는 자동 설치 패키지를 지우는 apt 한 줄", ["apt autoremove -y"], "확인 없이 진행하는 플래그를 포함합니다.", "apt autoremove는 고아 의존성을 제거한다.")
    stem("package", "hard", "reinstall", "nginx 패키지를 설정은 유지한 채 바이너리만 다시 깔고 싶다면?", ["apt install --reinstall -y nginx"], "reinstall 옵션입니다.", "apt install --reinstall은 동일 패키지를 재설치한다.")
    stem("package", "hard", "dpkg deb 추출", "package.deb 안의 파일 목록만 보는 dpkg 한 줄", ["dpkg -c package.deb"], "내용물 리스트 옵션입니다.", "dpkg -c는 deb 아카이브 목록을 본다.")
    stem("package", "hard", "rpm 쿼리", "httpd 패키지가 설치됐는지 확인하는 rpm 한 줄", ["rpm -q httpd"], "질의 모드입니다.", "rpm -q는 패키지 설치 여부를 확인한다.")

    # ── service ─────────────────────────────────────────────────────────
    stem("service", "easy", "nginx 상태", "nginx 서비스가 활성인지 확인하는 systemctl 한 줄", ["systemctl is-active nginx"], "상태 문자열만 출력하는 서브커맨드입니다.", "systemctl is-active는 활성/비활성을 출력한다.")
    stem("service", "easy", "부팅 시 자동 시작", "docker 서비스를 부팅 시 자동 시작하도록 설정하는 systemctl 한 줄", ["systemctl enable docker"], "심볼릭 링크를 만드는 enable입니다.", "systemctl enable은 unit을 부팅 타깃에 연결한다.")
    stem("service", "easy", "유닛 재시작", "ssh 서비스를 재시작하는 systemctl 한 줄", ["systemctl restart ssh", "systemctl restart sshd"], "배포판에 따라 유닛 이름이 ssh 또는 sshd 입니다.", "systemctl restart는 프로세스를 다시 띄운다.")
    stem("service", "medium", "저널 최근 로그", "nginx 유닛의 최근 50줄 저널을 보는 journalctl 한 줄", ["journalctl -u nginx -n 50"], "유닛 필터와 줄 수 제한입니다.", "journalctl -u는 유닛 로그를 필터한다.")
    stem("service", "medium", "실패 유닛 목록", "failed 상태인 systemd 유닛만 나열하는 systemctl 한 줄", ["systemctl --failed"], "실패한 유닛 요약입니다.", "systemctl --failed는 실패한 유닛을 보여준다.")
    stem("service", "medium", "유닛 파일 경로", "nginx.service 유닛 파일의 실제 경로를 확인하는 systemctl 한 줄", ["systemctl show -p FragmentPath nginx.service"], "FragmentPath 속성을 출력합니다.", "systemctl show -p는 특정 프로퍼티만 출력한다.")
    stem("service", "hard", "daemon-reload", "유닛 파일을 수정한 뒤 데몬 설정을 다시 읽게 하는 systemctl 한 줄", ["systemctl daemon-reload"], "유닛 변경 후 필수 단계입니다.", "daemon-reload는 systemd가 unit 파일을 다시 읽게 한다.")
    stem("service", "hard", "소켓 유닛 시작", "ssh.socket 을 시작하는 systemctl 한 줄", ["systemctl start ssh.socket"], "socket activated 서비스 전제입니다.", "systemctl start로 socket 유닛을 활성화한다.")
    stem("service", "hard", "마스크 해제", "docker.service 가 masked 일 때 마스크를 해제하는 systemctl 한 줄", ["systemctl unmask docker.service"], "mask의 반대입니다.", "systemctl unmask는 unit 마스크를 제거한다.")

    # ── search ──────────────────────────────────────────────────────────
    stem("search", "easy", "대소문자 무시 grep", "/etc/hosts 에서 localhost 를 대소문자 구분 없이 찾는 grep 한 줄", ["grep -i localhost /etc/hosts"], "ignore case 옵션입니다.", "grep -i는 대소문자 무시 매칭.")
    stem("search", "easy", "고정 문자열", "PATH 라는 글자 그대로만 찾고 정규식이 아니게 하려면?", ["grep -F PATH file.txt"], "문제에서 file.txt 를 대상으로 한다고 가정합니다.", "grep -F는 고정 문자열 모드.")
    stem("search", "easy", "매칭 줄 번호", "README.md 에서 error 가 나오는 줄에 번호를 붙여 출력", ["grep -n error README.md"], "line number 옵션입니다.", "grep -n은 줄 번호를 붙인다.")
    stem("search", "medium", "find 이름 대소문자 무시", "/home 아래에서 이름이 readme.md 인 파일을 대소문자 무시로 찾기", ["find /home -iname readme.md"], "iname 옵션입니다.", "find -iname은 이름 패턴을 대소문자 무시로 찾는다.")
    stem("search", "medium", "exec 로 삭제", "/tmp 아래 이름이 .log 로 끝나는 파일을 find 로 찾아 rm", ["find /tmp -name '*.log' -delete", "find /tmp -name '*.log' -exec rm {} \\;"], "배포판에 따라 -delete 또는 -exec를 사용합니다.", "find로 찾은 파일에 후속 명령을 실행한다.")
    stem("search", "medium", "awk 필드", "ps aux 출력에서 11번째 필드만 출력하는 awk 한 줄", ["awk '{print $11}'"], "필드 번호를 세는 연습입니다.", "awk는 공백 구분 필드로 접근한다.")
    stem("search", "hard", "ripgrep 타입", "현재 디렉터리에서 Rust 파일만 TODO 를 검색하는 rg 한 줄", ["rg TODO -t rust"], "타입 필터 옵션입니다.", "rg -t는 파일 타입 필터.")
    stem("search", "hard", "locate 업데이트", "mlocate 데이터베이스를 갱신하는 한 줄", ["updatedb"], "root 권한이 필요할 수 있습니다.", "updatedb는 locate 인덱스를 갱신한다.")
    stem("search", "hard", "git grep", "저장소 전체에서 foo 를 대소문자 무시로 찾는 git grep 한 줄", ["git grep -i foo"], "서브커맨드 이름을 맞추세요.", "git grep은 버전 관리 트리 내 검색.")

    # ── compression ───────────────────────────────────────────────────
    stem("compression", "easy", "gzip 압축", "data.log 를 gzip 으로 압축해 원본 제거하는 한 줄", ["gzip -k data.log", "gzip data.log"], "원본 제거/유지 옵션 차이를 문제 조건에 맞추세요.", "gzip은 기본적으로 원본을 지우고 .gz를 만든다.")
    stem("compression", "easy", "gzip 해제", "data.log.gz 를 풀어 현재 디렉터리에 풀린 파일만 남기는 gunzip 한 줄", ["gunzip data.log.gz"], "압축 해제 도구입니다.", "gunzip은 gzip 압축을 해제한다.")
    stem("compression", "easy", "zip 디렉터리", "/etc/nginx 디렉터리를 nginx-backup.zip 으로 재귀 압축", ["zip -r nginx-backup.zip /etc/nginx"], "재귀 옵션입니다.", "zip -r은 디렉터리를 재귀적으로 포함한다.")
    stem("compression", "medium", "tar.gz 생성", "/var/log 를 /tmp/logs.tar.gz 로 tar+gzip 한 줄", ["tar -czf /tmp/logs.tar.gz /var/log"], "옵션 순서에 주의하세요.", "tar -czf는 gzip으로 압축된 tar를 만든다.")
    stem("compression", "medium", "tar.xz 풀기", "app.tar.xz 를 현재 디렉터리에 풀기", ["tar -xJf app.tar.xz"], "xz 압축 해제 옵션입니다.", "tar -xJf는 xz 압축 tar를 푼다.")
    stem("compression", "medium", "단일 파일 bzip2", "big.bin 을 bzip2 로 압축", ["bzip2 -k big.bin", "bzip2 big.bin"], "원본 유지 옵션을 문제에 맞게 선택합니다.", "bzip2는 블록 정렬 압축기.")
    stem("compression", "hard", "tar exclude", "/home 을 백업하되 .cache 디렉터리는 제외하는 tar 한 줄", ["tar -czf /backup/home.tgz --exclude='.cache' -C / home"], "exclude와 -C 조합을 연습합니다.", "tar --exclude는 패턴에 맞는 경로를 제외한다.")
    stem("compression", "hard", "zstd 압축", "data.bin 을 zstd 로 압축해 data.bin.zst 생성", ["zstd -o data.bin.zst data.bin", "zstd data.bin"], "출력 파일 지정 방식을 확인하세요.", "zstd는 빠른 압축 알고리즘 도구.")
    stem("compression", "hard", "pigz 병렬", "logs.tar 를 pigz 로 4스레드 gzip", ["pigz -p 4 logs.tar"], "병렬 gzip 구현체입니다.", "pigz -p는 스레드 수를 지정한다.")

    # ── environment ─────────────────────────────────────────────────────
    stem("environment", "easy", "변수 출력", "FOO 변수 값을 출력하는 한 줄", ["echo \"$FOO\"", "echo $FOO"], "따옴표 유무에 따른 차이를 알고 있으면 됩니다.", "echo는 변수를 확장해 출력한다.")
    stem("environment", "easy", "일회성 변수", "BAR=1 ./script.sh 처럼 한 번만 BAR 를 설정해 실행하는 형태는?", ["BAR=1 ./script.sh"], "앞에 KEY=value 를 붙입니다.", "환경변수 앞치사는 해당 커맨드에만 적용된다.")
    stem("environment", "easy", "export", "QUX 를 이후 셸 자식까지 보이게 export 하는 한 줄", ["export QUX=1", "export QUX"], "값이 이미 있다면 export만으로도 됩니다.", "export는 변수를 환경으로 표시한다.")
    stem("environment", "medium", "PATH 앞에 추가", "/opt/app/bin 을 PATH 맨 앞에 붙여 export 하는 한 줄", ["export PATH=/opt/app/bin:$PATH"], "기존 PATH를 덮어쓰지 않게 주의합니다.", "PATH 앞에 디렉터리를 추가하면 우선 검색된다.")
    stem("environment", "medium", "env 실행", "환경변수 없이 깨끗한 환경에서 bash 을 띄우는 env 한 줄", ["env -i bash"], "비어 있는 환경 옵션입니다.", "env -i는 환경을 비우고 실행한다.")
    stem("environment", "medium", "alias 정의", "ll 을 ls -la 로 별칭 등록하는 bash 한 줄", ["alias ll='ls -la'"], "따옴표 처리에 유의하세요.", "alias는 셸 별칭을 만든다.")
    stem("environment", "hard", "set -euo pipefail", "bash 스크립트에서 엄격 모드를 켜는 한 줄", ["set -euo pipefail"], "세 옵션을 한 번에 켭니다.", "set -euo pipefail은 오류/미설정 변수/파이프 실패를 엄격히 다룬다.")
    stem("environment", "hard", "unset", "FOO 변수를 환경에서 제거", ["unset FOO"], "셸 빌트인입니다.", "unset은 변수를 제거한다.")
    stem("environment", "hard", "printenv 필터", "PATH 만 출력하는 printenv 한 줄", ["printenv PATH"], "인자로 변수 이름을 줍니다.", "printenv는 지정한 환경변수 값을 출력한다.")

    for cat in cats:
        for diff in diffs:
            for title, q, ans, hint, concept in stems.get((cat, diff), []):
                problems.append(
                    {
                        "title": title,
                        "category": cat,
                        "difficulty": diff,
                        "question": q,
                        "answer": ans,
                        "hint": hint,
                        "concept": concept,
                    }
                )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(problems, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(problems)} problems to {OUT}")


if __name__ == "__main__":
    main()

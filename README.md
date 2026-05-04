# Linux Coach

AI 피드백과 함께하는 리눅스 명령어 학습 플랫폼

---

## 기획 배경

리눅스 명령어를 공부할 때 가장 불편한 점은 "내가 쓴 답이 왜 틀렸는지"를 바로 알기 어렵다는 것이었습니다. 책이나 강의는 정답만 알려줄 뿐, 내가 틀린 이유나 어떻게 생각해야 하는지는 설명해주지 않습니다. 그래서 **틀렸을 때 AI가 피드백을 주고, 틀린 문제를 따로 모아서 복습할 수 있는 학습 도구**를 직접 만들어보기로 했습니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **문제 목록** | 10개 카테고리·4단계 난이도(입문/쉬움/보통/어려움), 200+ 내장 문제 |
| **개념 퀴즈 모드** | OX·객관식·단답형 140+ 문제, 카테고리/난이도 필터 + 세션 결과 |
| **답안 채점** | 명령어/퀴즈 입력 → 즉시 정답 판별, 퀴즈는 정답 공개 + 개념 설명 |
| **AI 코치 / Free Rule 코치** | API 키가 있으면 AI Mode로 자세한 피드백, 없으면 Free Rule Mode로 질문형 규칙 기반 피드백 자동 폴백 |
| **문제 생성** | AI로 원하는 카테고리·난이도 문제 생성 |
| **오답노트** | 틀린 문제 목록 + 피드백 복습 |
| **통계 / 약점 분석** | 정답률, 카테고리별 약점, 자주 틀리는 개념 TOP 5 |
| **프로필 페이지** | 사용자 정보 + 학습 통계 + 약점 분석 + 최근 오답 한눈에 |
| **데모 로그인** | 회원가입 없이 데모 계정으로 즉시 체험 가능 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v3, React Router v6 |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | PostgreSQL 16 |
| Auth | JWT (python-jose), bcrypt (passlib) |
| AI | Google Gemini → OpenAI → 규칙 기반 (우선순위 폴백) |
| Infra | Docker Compose, nginx (API 프록시) |

---

## 빠른 시작

### 1. 저장소 클론

```bash
git clone <repo-url>
cd linux-coach
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 API 키를 입력합니다 (선택사항 — 없으면 규칙 기반 모드로 동작):

```env
GOOGLE_API_KEY=your-gemini-api-key-here
# or
OPENAI_API_KEY=your-openai-api-key-here
```

### 3. Docker로 실행

```bash
docker compose up --build
```

| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8000 |
| API 문서 | http://localhost:8000/docs |

> **주의**: 처음 실행 시 Docker 이미지 빌드에 1–3분이 소요됩니다.

---

## 로컬 개발 환경

백엔드와 프론트엔드를 각각 실행할 수 있습니다.

### 백엔드

```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/linuxcoach uvicorn main:app --reload
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

vite.config.ts에 `/api` → `http://localhost:8000` 프록시가 설정되어 있으므로 별도 환경변수 없이 동작합니다.

---

## 아키텍처

```
Browser
  │
  ├─ GET/POST /api/*  ──►  nginx (port 3000)
  │                           │
  │                           └─► proxy_pass  ──►  FastAPI (port 8000)
  │                                                    │
  │                                                    └─► PostgreSQL (port 5432)
  │
  └─ GET /*  ──►  nginx  ──►  React SPA (static)
```

프론트엔드의 모든 API 요청은 `/api/` 경로로 시작하며, nginx가 `http://backend:8000/`으로 프록시합니다. 브라우저에서 백엔드 포트를 직접 알 필요가 없습니다.

---

## API 엔드포인트

| Method | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/health` | - | 서버 상태 확인 |
| GET | `/config` | - | AI 모드 확인 |
| POST | `/auth/register` | - | 회원가입 |
| POST | `/auth/login` | - | 로그인 |
| GET | `/auth/me` | ✓ | 내 정보 |
| GET | `/problems` | 선택 | 문제 목록 |
| GET | `/problems/{id}` | 선택 | 문제 상세 |
| POST | `/problems/{id}/submit` | ✓ | 답안 제출 |
| GET | `/stats` | ✓ | 학습 통계 |
| GET | `/wrong-notes` | ✓ | 오답노트 |
| POST | `/generate-problems` | ✓ | AI 문제 생성 |

---

## 인증 구조

- JWT (HS256), 30일 만료
- `localStorage`에 토큰 저장
- 모든 인증 요청에 `Authorization: Bearer <token>` 헤더 포함
- Seed 문제 (공개) vs 사용자 생성 문제 (본인만 접근) 격리

---

## 데이터베이스 구조

```
users
  id, email (unique), username (unique), password_hash, created_at

problems
  id, title, category, difficulty, question, answer, hint, concept
  ai_generated, owner_id → users.id (NULL = 공개 seed 문제)

submissions
  id, problem_id → problems.id, user_id → users.id
  user_answer, is_correct, feedback, created_at
```

---

## AI 모드

| 환경변수 | 동작 |
|----------|------|
| `OPENAI_API_KEY` 설정 | OpenAI GPT 사용 |
| `GOOGLE_API_KEY` 설정 | Google Gemini 사용 |
| 둘 다 없음 | 규칙 기반 피드백 (무료, 오프라인) |

---

## 문제 해결

**백엔드 로그 확인:**
```bash
docker compose logs backend
```

**DB 초기화:**
```bash
docker compose down -v && docker compose up --build
```

**포트 충돌:**
`docker-compose.yml`에서 `3000:80` 또는 `8000:8000`을 다른 포트로 변경하세요.

---

## AI Mode vs Free Rule Mode

Linux Coach는 두 가지 코치 모드를 자동으로 전환해요. 환경변수에 `OPENAI_API_KEY` 또는 `GOOGLE_API_KEY` 가 있으면 **AI Mode**, 둘 다 없으면 **Free Rule Mode**가 됩니다.

| 모드 | 동작 | 표시 |
|------|------|------|
| **AI Mode** | OpenAI/Gemini가 오답을 분석해 자세한 피드백 생성 | 사이드바·로그인·프로필 상단에 파란 배지 |
| **Free Rule Mode** | API 키 없이 내장 규칙 기반 코치가 질문형 피드백 제공 | 노란 배지 + "무료 모드에서는 내장 규칙 기반 코치가 질문형 피드백을 제공합니다." 안내 |

> 💡 API 키 없이도 앱은 정상 동작하며, 오답 시 항상 피드백이 표시됩니다.

`/config` 엔드포인트가 다음 응답을 줍니다:
```json
{
  "ai_enabled": true | false,
  "ai_mode": "AI Mode" | "Free Rule Mode",
  "demo_email": "demo@linuxcoach.local",
  "demo_password": "demo1234"
}
```

---

## 프로필 페이지

`/profile` 라우트(로그인 필요)에서 다음을 확인할 수 있어요:

- 사용자명 / 이메일 / 가입일 / 현재 코치 모드
- 총 풀이 / 정답 / 오답 / 정답률 / 내가 만든 문제 수
- **약점 카테고리 TOP 3** — 카테고리별 오답률 막대 그래프
- **자주 틀리는 개념 TOP 5** — 같은 concept을 반복해서 틀린 빈도
- **최근 오답 5건** — 클릭하면 해당 문제로 이동

API: `GET /profile` (JWT 인증 필요)

---

## 개념 퀴즈 모드

`/quiz`에서 OX · 객관식 · 단답형 140개 이상의 개념 문제를 풀 수 있어요.

- 카테고리, 난이도, 유형 필터로 세션 구성 (최대 20문제)
- 비로그인 상태에서도 클라이언트 측 채점으로 체험 가능
- 로그인 시 백엔드에서 채점 + 통계/오답노트에 자동 누적
- 모든 문제는 **상황형 문장 + WHY 설명** 패턴으로 작성:
  - 나쁜 예: "ls란 무엇인가?"
  - 좋은 예: "방금 디렉터리에 들어왔는데 어떤 파일들이 있는지 한눈에 보고 싶습니다. 어떤 명령어를 쓸까요?"

---

## 데모 계정

회원가입 디버깅을 거치지 않고도 즉시 체험할 수 있도록 시드된 데모 계정이 자동 생성됩니다:

- 이메일: `demo@linuxcoach.local`
- 비밀번호: `demo1234`

로그인 페이지의 **"데모 계정으로 빠른 시작"** 버튼을 누르면 자동으로 로그인됩니다.

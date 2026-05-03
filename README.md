# Linux Coach

AI 피드백과 함께하는 리눅스 명령어 학습 플랫폼

---

## 기획 배경

리눅스 명령어를 공부할 때 가장 불편한 점은 "내가 쓴 답이 왜 틀렸는지"를 바로 알기 어렵다는 것이었습니다. 책이나 강의는 정답만 알려줄 뿐, 내가 틀린 이유나 어떻게 생각해야 하는지는 설명해주지 않습니다. 그래서 **틀렸을 때 AI가 피드백을 주고, 틀린 문제를 따로 모아서 복습할 수 있는 학습 도구**를 직접 만들어보기로 했습니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **문제 목록** | 10개 카테고리·3단계 난이도, 80개+ 내장 문제 |
| **답안 채점** | 명령어 입력 → 즉시 정답 판별 |
| **AI 피드백** | 오답 시 Gemini / OpenAI가 왜 틀렸는지 설명 |
| **문제 생성** | AI로 원하는 카테고리·난이도 문제 생성 |
| **오답노트** | 틀린 문제 목록 + 피드백 복습 |
| **통계** | 정답률, 카테고리별·난이도별 분석 |
| **인증** | JWT 기반 회원가입/로그인, 사용자별 데이터 격리 |

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

# 🐧 Linux Coach

CLI 명령어 학습 플랫폼 — 문제 풀이 · 개념 퀴즈 · AI 피드백 · 오답노트 · 통계

---

## 기능 개요

| 기능 | 설명 |
|------|------|
| 문제 풀이 | 10개 카테고리 × 4단계 난이도 명령어 문제 |
| 개념 퀴즈 | OX · 객관식 · 단답형 150+ 문제 |
| AI 문제 생성 | 카테고리/난이도 지정 후 즉시 생성 (로그인 필요) |
| 오답노트 | 틀린 문제 + AI/규칙 피드백 복습 |
| 통계 | 정답률 · 카테고리별 현황 분석 |
| Guest Mode | 로그인 없이 localStorage 기반 학습 기록 저장 |

---

## 계정 관리

### Guest Mode vs 로그인 사용자

| 항목 | Guest Mode | 로그인 사용자 |
|------|-----------|--------------|
| 문제 풀이 | ✅ 가능 | ✅ 가능 |
| 퀴즈 | ✅ 가능 | ✅ 가능 |
| 오답노트 | ✅ localStorage | ✅ 서버 DB |
| 통계 | ✅ localStorage | ✅ 서버 DB |
| AI 문제 생성 | ❌ 불가 | ✅ 가능 |
| 기록 영구 보존 | ❌ 브라우저 삭제 시 소실 | ✅ 영구 저장 |

> **TODO**: Guest → 로그인 계정으로 기록 이전 기능 미구현

### 회원가입 / 로그인

- `/register` — 이메일 · 사용자명 · 비밀번호(8자+)로 가입, 가입 성공 시 자동 로그인
- `/login` — 이메일 + 비밀번호 로그인 또는 데모 계정 원클릭 로그인

### 비밀번호 변경

로그인 상태에서 **설정(Settings) 페이지 → 비밀번호 변경** 섹션에서 변경 가능합니다.

- 현재 비밀번호 재확인 필요
- 새 비밀번호 최소 8자, 최대 72바이트 (bcrypt 제한)
- 기존 비밀번호와 동일한 비밀번호로 변경 불가

```
POST /auth/change-password
{ current_password, new_password, confirm_new_password }
```

### 비밀번호 재설정 (이메일 미발송 개발 모드)

> ⚠️ **실제 이메일 발송은 구현되지 않았습니다.**
> 개발 모드(`ENV != "production"`)에서는 재설정 토큰이 **API 응답 body에 직접 포함**됩니다.
> 운영 환경에서는 토큰을 응답에 포함하지 않으며, 이메일 발송(SMTP/SES/SendGrid)은 **TODO**입니다.

**개발 환경 사용 방법:**

1. `/forgot-password` 접속 → 이메일 입력 → "재설정 링크 요청" 클릭
2. 응답에서 `dev_token` 또는 `→ 비밀번호 재설정 페이지로 이동` 링크 확인
3. 해당 링크 클릭 또는 `/reset-password?token=<토큰>` 직접 접속
4. 새 비밀번호 입력 후 재설정

**토큰 보안 정책:**

- DB에는 `SHA-256(token)` 해시만 저장 — 원문 절대 저장 안 함
- 만료 시간: 30분
- 1회 사용 후 재사용 불가
- 새 토큰 생성 시 기존 미사용 토큰 자동 무효화

```
POST /auth/forgot-password  { email }
POST /auth/reset-password   { token, new_password, confirm_new_password }
```

### 계정 찾기

이메일 인증 없이 사용자명 또는 이메일로 계정을 조회할 수 있습니다.

- **사용자명으로 찾기** → 마스킹된 이메일 반환 (예: `kim@example.com` → `k**@example.com`)
- **이메일로 찾기** → 사용자명 반환

```
POST /auth/find-account  { email? } | { username? }
```

### 프로필 수정

설정 페이지에서 **사용자명** 변경 가능.

> 이메일 변경은 실제 이메일 인증이 없으므로 **현재 지원하지 않습니다** (TODO).

```
PATCH /auth/me  { username }
```

### 회원 탈퇴

설정 페이지 → **위험 영역 → 탈퇴하기**.

- 비밀번호 재확인 필요
- 확인 문구 `DELETE` 또는 `탈퇴합니다` 직접 입력 필요
- **Soft Delete** 방식 — `is_active=false`, `deleted_at` 기록 (데이터 즉시 삭제 없음)
- 탈퇴 계정으로 로그인 시도 시 403 반환

```
DELETE /auth/me  { password, confirm_text }
```

### 데모 계정

`demo@linuxcoach.local` / `demo1234` — 로그인 페이지 "데모 계정으로 빠른 시작" 버튼으로 접근.

- **로그아웃 시 자동으로 모든 학습 기록 삭제** (submissions · AI 생성 문제)
- 다시 로그인하면 깨끗한 상태에서 시작
- 일반 사용자 데이터는 절대 삭제되지 않음 (백엔드 `is_demo` 플래그로 이중 보호)

---

## 코치 모드

| 모드 | 조건 | 피드백 |
|------|------|--------|
| Free Rule Mode | API Key 없음 | 내장 규칙 기반 Socratic 질문형 피드백 |
| User AI Mode | 브라우저 localStorage에 API Key 저장 | OpenAI / Gemini 사용 |
| Admin AI Mode | 서버 환경변수에 API Key 설정 | 서버 키 사용 |

API Key는 **서버 DB에 절대 저장되지 않으며** 브라우저 localStorage에만 보관됩니다.

---

## Docker 실행

```bash
docker-compose up --build
# Frontend: http://localhost:3000
# Backend API: http://localhost:3000/api
```

---

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `JWT_SECRET` | JWT 서명 키 | `dev-secret-key-CHANGE-THIS-IN-PRODUCTION` |
| `ENV` | `production`이면 reset token 응답 비공개 | `development` |
| `OPENAI_API_KEY` | Admin AI Mode 활성화 (선택) | — |
| `GEMINI_API_KEY` | Admin AI Mode 활성화 (선택) | — |

---

## TODO (미구현)

- [ ] 실제 이메일 발송 (SMTP / SES / SendGrid) — forgot-password 운영용
- [ ] 이메일 인증 후 이메일 변경
- [ ] Guest → 로그인 계정으로 학습 기록 이전
- [ ] 소셜 로그인 (OAuth)
- [ ] 비밀번호 강도 표시
- [ ] 로그인 실패 횟수 제한 (rate limiting)

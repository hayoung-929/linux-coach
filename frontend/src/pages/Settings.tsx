import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, fetchAppConfig, getToken } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  AIProvider,
  clearGuestSubmissions,
  clearUserAIKey,
  getUserAIKey,
  resolveCoachMode,
  setUserAIKey,
} from "../lib/guestStore";
import type { AppConfig, TokenResponse } from "../types";

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-ink-200 mb-3">{title}</h2>
      <div className="rounded-xl border border-ink-800 bg-ink-900 p-5">{children}</div>
    </section>
  );
}

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs text-emerald-400 ml-2">저장됨 ✓</span>;
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-red-400 text-xs">✕</span>
      <p className="text-xs text-red-300">{msg}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<AppConfig | null>(null);

  // ── AI key state ────────────────────────────────────────────────────────────
  const initial = getUserAIKey();
  const [provider, setProvider] = useState<AIProvider>(initial.provider);
  const [keyVal, setKeyVal] = useState(initial.key);
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // ── Change password state (logged-in only) ──────────────────────────────────
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSaved, setCpSaved] = useState(false);
  const [showCpCurrent, setShowCpCurrent] = useState(false);
  const [showCpNew, setShowCpNew] = useState(false);

  // ── Update profile state (logged-in only) ───────────────────────────────────
  const [newUsername, setNewUsername] = useState(user?.username ?? "");
  const [upError, setUpError] = useState("");
  const [upLoading, setUpLoading] = useState(false);
  const [upSaved, setUpSaved] = useState(false);

  // ── Delete account state (logged-in only) ───────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delConfirmText, setDelConfirmText] = useState("");
  const [delError, setDelError] = useState("");
  const [delLoading, setDelLoading] = useState(false);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, []);

  // Keep username field in sync if user changes externally
  useEffect(() => {
    if (user) setNewUsername(user.username);
  }, [user]);

  // ── AI key handlers ─────────────────────────────────────────────────────────

  function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setUserAIKey(provider, keyVal);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }

  function clearKey() {
    clearUserAIKey();
    setProvider("");
    setKeyVal("");
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }

  function clearGuestData() {
    if (!window.confirm("Guest Mode 학습 기록을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    clearGuestSubmissions();
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }

  // ── Change password ─────────────────────────────────────────────────────────

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (cpNew.length < 8) { setCpError("새 비밀번호는 8자 이상이어야 합니다."); return; }
    if (cpNew !== cpConfirm) { setCpError("새 비밀번호와 확인이 일치하지 않습니다."); return; }
    setCpError("");
    setCpLoading(true);
    try {
      const r = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: cpCurrent,
          new_password: cpNew,
          confirm_new_password: cpConfirm,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCpError(typeof data?.detail === "string" ? data.detail : "비밀번호 변경에 실패했습니다.");
        return;
      }
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
      setCpSaved(true);
      setTimeout(() => setCpSaved(false), 3000);
    } catch {
      setCpError("서버에 연결할 수 없습니다.");
    } finally {
      setCpLoading(false);
    }
  }

  // ── Update profile ──────────────────────────────────────────────────────────

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (newUsername.length < 2) { setUpError("사용자명은 2자 이상이어야 합니다."); return; }
    if (newUsername === user?.username) { setUpError("현재 사용자명과 동일합니다."); return; }
    setUpError("");
    setUpLoading(true);
    try {
      const r = await apiFetch("/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setUpError(typeof data?.detail === "string" ? data.detail : "프로필 수정에 실패했습니다.");
        return;
      }
      // Re-fetch updated user via /auth/me and update context with new username
      const meR = await apiFetch("/auth/me");
      if (meR.ok) {
        const meData = await meR.json();
        const token = getToken();
        if (token) login({ access_token: token, token_type: "bearer", user: meData } as TokenResponse);
      }
      setUpSaved(true);
      setTimeout(() => setUpSaved(false), 3000);
    } catch {
      setUpError("서버에 연결할 수 없습니다.");
    } finally {
      setUpLoading(false);
    }
  }

  // ── Delete account ──────────────────────────────────────────────────────────

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!delPassword) { setDelError("비밀번호를 입력해주세요."); return; }
    if (delConfirmText !== "DELETE" && delConfirmText !== "탈퇴합니다") {
      setDelError('"DELETE" 또는 "탈퇴합니다"를 정확히 입력해주세요.');
      return;
    }
    setDelError("");
    setDelLoading(true);
    try {
      const r = await apiFetch("/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: delPassword, confirm_text: delConfirmText }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setDelError(typeof data?.detail === "string" ? data.detail : "탈퇴 처리에 실패했습니다.");
        return;
      }
      // Deactivated — clear local session and go home
      await logout();
      navigate("/", { replace: true });
    } catch {
      setDelError("서버에 연결할 수 없습니다.");
    } finally {
      setDelLoading(false);
    }
  }

  const mode = cfg ? resolveCoachMode(cfg.ai_enabled) : "free_rule";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-ink-500">코치 모드, 계정, 학습 기록을 관리해요.</p>
      </div>

      {/* ── Coach mode ── */}
      <Section title="">
        <p className="text-2xs font-semibold uppercase tracking-widest text-ink-600 mb-2">현재 코치 모드</p>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              mode === "user_ai"
                ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                : mode === "admin_ai"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${
              mode === "user_ai" ? "bg-sky-500" : mode === "admin_ai" ? "bg-emerald-500" : "bg-amber-500"
            }`} />
            {mode === "user_ai" ? "User AI Mode" : mode === "admin_ai" ? "Admin AI Mode" : "Free Rule Mode"}
          </span>
        </div>
        <p className="mt-3 text-xs text-ink-500 leading-relaxed">
          {mode === "user_ai"
            ? "현재 브라우저에 저장된 API Key로 AI 피드백을 받고 있어요."
            : mode === "admin_ai"
            ? "서버에 등록된 API Key로 AI 피드백이 동작 중이에요."
            : "내장 규칙 기반 코치가 질문형 피드백을 제공합니다. 더 나은 피드백을 원하면 아래에서 API Key를 입력하세요."}
        </p>
      </Section>

      {/* ── User API key ── */}
      <Section title="개인 API Key (선택)">
        <p className="text-xs text-ink-500 leading-relaxed">
          본인의 OpenAI 또는 Gemini API Key를 입력하면{" "}
          <span className="text-sky-400 font-medium">User AI Mode</span>로 동작합니다.{" "}
          <span className="text-amber-300">Key는 현재 브라우저(localStorage)에만 저장</span>되며 서버 DB에 저장되지 않아요.
        </p>
        <form onSubmit={saveKey} className="mt-4 space-y-3">
          <div>
            <label className="block mb-1.5 text-xs font-medium text-ink-500">제공자</label>
            <div className="flex gap-2">
              {([
                { val: "" as AIProvider, label: "사용 안 함" },
                { val: "openai" as AIProvider, label: "OpenAI" },
                { val: "gemini" as AIProvider, label: "Gemini" },
              ] as { val: AIProvider; label: string }[]).map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setProvider(opt.val)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    provider === opt.val
                      ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                      : "border-ink-700 text-ink-500 hover:border-ink-600 hover:text-ink-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {provider && (
            <div>
              <label className="block mb-1.5 text-xs font-medium text-ink-500">API Key</label>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={keyVal}
                  onChange={(e) => setKeyVal(e.target.value)}
                  placeholder={provider === "openai" ? "sk-..." : "AIza..."}
                  autoComplete="off"
                  className="flex-1 rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm font-mono text-ink-100 placeholder:text-ink-700 focus:border-ink-500 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="rounded-md border border-ink-700 px-3 py-2 text-xs text-ink-500 hover:border-ink-500 hover:text-ink-200 transition-colors"
                >
                  {showKey ? "숨김" : "표시"}
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button type="submit" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 transition-colors">
              저장
            </button>
            <button type="button" onClick={clearKey} className="rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-400 hover:border-red-500/40 hover:text-red-400 transition-colors">
              삭제
            </button>
            <SavedBadge show={keySaved} />
          </div>
        </form>
        <div className="mt-4 rounded border border-amber-500/15 bg-amber-500/5 px-3 py-2">
          <p className="text-2xs text-amber-300/80 leading-relaxed">
            ⚠ 이 Key는 현재 브라우저에만 저장됩니다. 공용 PC에서 사용 후 반드시 삭제하세요.
          </p>
        </div>
      </Section>

      {/* ── Change password (logged-in only) ── */}
      {user && !user.is_demo && (
        <Section title="비밀번호 변경">
          <form onSubmit={handleChangePassword} className="space-y-3">
            {/* Current password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-500">현재 비밀번호</label>
              <div className="flex gap-2">
                <input
                  type={showCpCurrent ? "text" : "password"}
                  value={cpCurrent}
                  onChange={(e) => { setCpCurrent(e.target.value); setCpError(""); }}
                  autoComplete="current-password"
                  disabled={cpLoading}
                  placeholder="현재 비밀번호"
                  className="flex-1 rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-700 focus:border-ink-500 outline-none transition-colors disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowCpCurrent(v => !v)} className="rounded-md border border-ink-700 px-3 py-2 text-xs text-ink-500 hover:border-ink-500 hover:text-ink-200 transition-colors">
                  {showCpCurrent ? "숨김" : "표시"}
                </button>
              </div>
            </div>
            {/* New password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-500">새 비밀번호</label>
              <div className="flex gap-2">
                <input
                  type={showCpNew ? "text" : "password"}
                  value={cpNew}
                  onChange={(e) => { setCpNew(e.target.value); setCpError(""); }}
                  autoComplete="new-password"
                  disabled={cpLoading}
                  placeholder="8자 이상"
                  className="flex-1 rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-700 focus:border-ink-500 outline-none transition-colors disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowCpNew(v => !v)} className="rounded-md border border-ink-700 px-3 py-2 text-xs text-ink-500 hover:border-ink-500 hover:text-ink-200 transition-colors">
                  {showCpNew ? "숨김" : "표시"}
                </button>
              </div>
            </div>
            {/* Confirm */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-500">새 비밀번호 확인</label>
              <input
                type="password"
                value={cpConfirm}
                onChange={(e) => { setCpConfirm(e.target.value); setCpError(""); }}
                autoComplete="new-password"
                disabled={cpLoading}
                placeholder="비밀번호 재입력"
                className={`w-full rounded-md border bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-700 outline-none transition-colors disabled:opacity-50 ${
                  cpConfirm && cpConfirm !== cpNew ? "border-red-500/50" : "border-ink-700 focus:border-ink-500"
                }`}
              />
              {cpConfirm && cpConfirm !== cpNew && (
                <p className="mt-1 text-2xs text-red-400">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            <ErrorMsg msg={cpError} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={cpLoading || (cpConfirm.length > 0 && cpConfirm !== cpNew)}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {cpLoading ? "변경 중…" : "비밀번호 변경"}
              </button>
              <SavedBadge show={cpSaved} />
            </div>
          </form>
        </Section>
      )}

      {/* ── Update profile (logged-in only) ── */}
      {user && (
        <Section title="프로필 수정">
          <p className="text-xs text-ink-600 mb-4 leading-relaxed">
            사용자명을 변경할 수 있어요.{" "}
            이메일 변경은 실제 이메일 인증이 필요하므로 현재 지원하지 않습니다.{/* TODO: email verification */}
          </p>
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-500">사용자명</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => { setNewUsername(e.target.value); setUpError(""); }}
                disabled={upLoading}
                minLength={2}
                maxLength={80}
                placeholder="새 사용자명"
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-700 focus:border-ink-500 outline-none transition-colors disabled:opacity-50"
              />
              <p className="mt-1 text-2xs text-ink-700">2~80자</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-500">이메일 (변경 불가)</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full rounded-md border border-ink-800 bg-ink-950/50 px-3 py-2 text-sm text-ink-600 outline-none cursor-not-allowed"
              />
            </div>
            <ErrorMsg msg={upError} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={upLoading || newUsername === user.username}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {upLoading ? "저장 중…" : "저장"}
              </button>
              <SavedBadge show={upSaved} />
            </div>
          </form>
        </Section>
      )}

      {/* ── Guest data ── */}
      <Section title="Guest Mode 데이터">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-300">로컬에 저장된 풀이 기록 / 정답 본 문제 목록</p>
            <p className="mt-1 text-xs text-ink-600">
              로그인하지 않은 상태에서의 모든 학습 데이터는 이 브라우저의 localStorage에만 저장돼요.
            </p>
          </div>
          <button
            type="button"
            onClick={clearGuestData}
            className="shrink-0 rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-400 hover:border-red-500/40 hover:text-red-400 transition-colors"
          >
            전체 삭제
          </button>
        </div>
      </Section>

      {/* ── Danger zone (logged-in + non-demo) ── */}
      {user && !user.is_demo && (
        <section>
          <h2 className="text-sm font-semibold text-red-400 mb-3">위험 영역</h2>
          <div className="rounded-xl border border-red-500/20 bg-red-500/3 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink-200">계정 탈퇴</p>
                <p className="mt-1 text-xs text-ink-600 leading-relaxed">
                  탈퇴 후에는 이 계정으로 로그인할 수 없습니다.
                  학습 기록은 보존되지만 계정은 비활성화됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="shrink-0 rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Delete account modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-950/80 backdrop-blur-sm">
          <div className="w-full max-w-[400px] rounded-xl border border-red-500/20 bg-ink-900 p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-red-400 mb-1">계정 탈퇴 확인</h2>
            <p className="text-xs text-ink-500 mb-5 leading-relaxed">
              이 작업은 되돌릴 수 없습니다. 탈퇴 후에는 이 계정으로 로그인할 수 없으며
              새 계정을 만들어야 합니다.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-400">현재 비밀번호</label>
                <input
                  type="password"
                  value={delPassword}
                  onChange={(e) => { setDelPassword(e.target.value); setDelError(""); }}
                  autoComplete="current-password"
                  disabled={delLoading}
                  placeholder="비밀번호 재확인"
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-700 focus:border-red-500/50 outline-none transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-400">
                  확인 문구 입력
                </label>
                <input
                  type="text"
                  value={delConfirmText}
                  onChange={(e) => { setDelConfirmText(e.target.value); setDelError(""); }}
                  disabled={delLoading}
                  placeholder={'"DELETE" 또는 "탈퇴합니다" 입력'}
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm font-mono text-ink-100 placeholder:text-ink-700 focus:border-red-500/50 outline-none transition-colors disabled:opacity-50"
                />
                <p className="mt-1 text-2xs text-ink-700">
                  <code className="text-ink-500">DELETE</code> 또는{" "}
                  <code className="text-ink-500">탈퇴합니다</code>를 정확히 입력해주세요.
                </p>
              </div>

              <ErrorMsg msg={delError} />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDelPassword(""); setDelConfirmText(""); setDelError(""); }}
                  disabled={delLoading}
                  className="flex-1 rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-400 hover:border-ink-500 hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={delLoading || !delPassword || (delConfirmText !== "DELETE" && delConfirmText !== "탈퇴합니다")}
                  className="flex-1 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {delLoading ? "처리 중…" : "탈퇴 확인"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

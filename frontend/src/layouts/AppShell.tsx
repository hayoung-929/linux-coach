import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_URL, fetchAppConfig } from "../api";
import { useAuth } from "../context/AuthContext";
import { coachModeLabel, resolveCoachMode } from "../lib/guestStore";
import type { AppConfig } from "../types";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconList() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  );
}
function IconBookmark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconPuzzle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-3.408 0l-1.569-1.567a.881.881 0 0 0-.878-.29c-.493.116-.881.56-.914 1.066a2.5 2.5 0 1 1-3.476-3.476c.507-.033.95-.421 1.067-.914a.881.881 0 0 0-.29-.878L4.28 13.28a2.404 2.404 0 0 1 0-3.408l1.568-1.569a.881.881 0 0 0 .29-.878C6.022 6.932 5.579 6.49 5.072 6.457a2.5 2.5 0 1 1 3.476-3.476c-.033.507.421.95.914 1.067a.881.881 0 0 0 .878-.29l1.568-1.568a2.404 2.404 0 0 1 3.408 0l1.569 1.567c.23.231.556.339.878.29.493-.116.881-.56.914-1.066a2.5 2.5 0 0 1 .729 4.229z"/>
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconLogOut() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconLogin() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV = [
  { to: "/", icon: IconGrid, label: "대시보드", end: true },
  { to: "/problems", icon: IconList, label: "문제 목록", end: false },
  { to: "/quiz", icon: IconPuzzle, label: "개념 퀴즈", end: false },
  { to: "/generate", icon: IconSparkle, label: "문제 생성", end: false, auth: true },
  { to: "/wrong-notes", icon: IconBookmark, label: "오답노트", end: false },
  { to: "/stats", icon: IconChart, label: "통계", end: false },
  { to: "/profile", icon: IconUser, label: "프로필", end: false, auth: true },
  { to: "/settings", icon: IconSettings, label: "설정", end: false },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function NavItem({ to, icon: Icon, label, end }: { to: string; icon: () => JSX.Element; label: string; end: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
          isActive
            ? "bg-ink-800 text-ink-100 font-medium"
            : "text-ink-500 hover:bg-ink-800/60 hover:text-ink-300",
        ].join(" ")
      }
    >
      <Icon />
      {label}
    </NavLink>
  );
}

function UserBadge({ username }: { username: string }) {
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-2xs font-bold text-sky-400 ring-1 ring-sky-500/30">
      {initials}
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

export default function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [health, setHealth] = useState<"ok" | "down" | "unk">("unk");
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAppConfig().then(setCfg);
  }, [pathname]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => setHealth(r.ok ? "ok" : "down"))
      .catch(() => setHealth("down"));
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const visibleNav = NAV.filter((n) => !n.auth || user);

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-ink-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-800 text-base select-none">
          🐧
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-ink-100">Linux Coach</div>
          <div className="text-2xs text-ink-600">CLI 학습 플랫폼</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {visibleNav.map(({ to, icon, label, end }) => (
          <NavItem key={to} to={to} icon={icon} label={label} end={end} />
        ))}
        {!user && (
          <NavItem to="/login" icon={IconLogin} label="로그인" end={false} />
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-ink-800 p-3 space-y-2">
        {/* Coach mode badge */}
        {cfg && (() => {
          const m = resolveCoachMode(cfg.ai_enabled);
          const label = coachModeLabel(m);
          const dot = m === "user_ai" ? "bg-sky-500" : m === "admin_ai" ? "bg-emerald-500" : "bg-amber-500";
          const text = m === "user_ai" ? "text-sky-400" : m === "admin_ai" ? "text-emerald-400" : "text-amber-400";
          return (
            <Link
              to="/settings"
              className="flex items-center gap-2 px-1 rounded py-1 hover:bg-ink-800/40 transition-colors no-underline"
              title="설정에서 코치 모드를 바꿀 수 있어요"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              <span className={`text-2xs font-medium ${text}`}>{label}</span>
              <span className="ml-auto text-2xs text-ink-700">
                {user ? "" : "Guest"}
              </span>
            </Link>
          );
        })()}

        {/* API status */}
        <div className="flex items-center gap-2 px-1">
          <span
            className={`h-1 w-1 rounded-full ${
              health === "ok" ? "bg-emerald-500" : health === "down" ? "bg-red-500" : "bg-ink-600"
            }`}
          />
          <span className="text-2xs text-ink-700">
            서버 {health === "ok" ? "연결됨" : health === "down" ? "오프라인" : "확인 중"}
          </span>
        </div>

        {/* User info */}
        {user ? (
          <div className="flex items-center gap-2 rounded-md px-1 py-1">
            <Link to="/profile" className="flex items-center gap-2 flex-1 min-w-0 hover:bg-ink-800/40 rounded p-1 -m-1 transition-colors no-underline">
              <UserBadge username={user.username} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-200 truncate">{user.username}</p>
                <p className="text-2xs text-ink-600 truncate">{user.email}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              title="로그아웃"
              className="shrink-0 text-ink-600 hover:text-red-400 transition-colors p-1 rounded"
            >
              <IconLogOut />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-500 hover:text-ink-200 hover:bg-ink-800/60 transition-colors"
          >
            <IconLogin />
            로그인 / 회원가입
          </Link>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-ink-950 text-ink-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col border-r border-ink-800 bg-ink-900">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        ref={sidebarRef}
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-ink-800 bg-ink-900 transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="flex h-12 items-center gap-3 border-b border-ink-800 bg-ink-900 px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="text-ink-500 hover:text-ink-200 transition-colors"
          >
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
          <span className="text-sm font-semibold text-ink-100">Linux Coach</span>
          {cfg && (() => {
            const m = resolveCoachMode(cfg.ai_enabled);
            const label = coachModeLabel(m);
            const cls = m === "user_ai"
              ? "border-sky-500/25 text-sky-400"
              : m === "admin_ai"
              ? "border-emerald-500/25 text-emerald-400"
              : "border-amber-500/25 text-amber-400";
            return (
              <span className={`ml-auto text-2xs font-semibold px-2 py-0.5 rounded border ${cls}`}>
                {label}
              </span>
            );
          })()}
          {user && (
            <UserBadge username={user.username} />
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

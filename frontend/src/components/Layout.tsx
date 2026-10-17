import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Bot, Gift, ClipboardList, GraduationCap, Home, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";
import { api } from "../api/client";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useI18n, type TKey } from "../i18n";

const NAV: { to: string; key: TKey; icon: typeof Home; roles?: Role[] }[] = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/requests", key: "nav.requests", icon: ClipboardList },
  { to: "/team", key: "nav.team", icon: Users, roles: ["manager", "hr"] },
  { to: "/academy", key: "nav.academy", icon: GraduationCap },
  { to: "/rewards", key: "nav.rewards", icon: Gift },
  { to: "/assistant", key: "nav.assistant", icon: Bot },
  { to: "/hr", key: "nav.hr", icon: ShieldCheck, roles: ["hr"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.unreadCount().then((r) => setUnread(r.count)).catch(() => {});
    setOpen(false);
  }, [location.pathname]);

  if (!user) return null;
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const onLogout = () => { logout(); navigate("/login"); };

  const side = (
    <>
      <Logo />
      <nav className="mt-10 flex flex-1 flex-col gap-1">
        {items.map(({ to, key, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] transition-colors ${
                isActive ? "bg-signal font-semibold text-forest" : "text-white/65 hover:bg-white/8 hover:text-white"
              }`}>
            {({ isActive }) => (<><Icon size={19} strokeWidth={isActive ? 2.3 : 1.8} />{t(key)}</>)}
          </NavLink>
        ))}
      </nav>
      <div className="rounded-2xl bg-forest-2 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal font-display text-[13px] font-bold text-forest">
            {user.employee.full_name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user.employee.full_name.split(" ").slice(0, 2).join(" ")}</p>
            <p className="truncate text-xs text-white/50">{t(`role.${user.role}`)}</p>
          </div>
          <button onClick={onLogout} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Выйти" title="Выйти">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell flex min-h-screen text-ink">
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col bg-forest px-5 py-7 lg:flex">
        {side}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="relative flex h-full w-[288px] flex-col bg-forest px-5 py-7" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-4 top-6 rounded-lg p-1.5 text-white/60 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Закрыть меню">
              <X size={20} />
            </button>
            {side}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 bg-paper/90 px-4 backdrop-blur lg:px-10">
          <button className="rounded-xl bg-forest p-2 text-white lg:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu size={20} /></button>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-full bg-white p-1 text-xs font-semibold" role="group" aria-label="Язык">
              {(["ru", "kz"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`rounded-full px-3 py-1.5 transition-colors ${lang === l ? "bg-forest text-white" : "text-muted hover:text-ink"}`}>
                  {l === "ru" ? "Рус" : "Қаз"}
                </button>
              ))}
            </div>
            <NavLink to="/notifications"
              className={({ isActive }) => `relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isActive ? "bg-forest text-white" : "bg-white hover:bg-white/70"}`}
              aria-label={`${t("nav.notifications")}${unread ? `: ${unread}` : ""}`}>
              <Bell size={18} strokeWidth={2} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-paper bg-signal px-1 text-[10px] font-bold text-forest">
                  {unread}
                </span>
              )}
            </NavLink>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-14 pt-2 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f3a22" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 7l9 6 9-6" /><rect x="3" y="5" width="18" height="14" rx="2.5" />
        </svg>
      </span>
      <span className="font-display text-[19px] font-bold tracking-[-0.03em] text-white">
        <span className="text-signal">JANA</span>MEN
      </span>
    </div>
  );
}

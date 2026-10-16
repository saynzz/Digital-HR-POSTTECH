import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Bot, ClipboardList, GraduationCap, Home, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";
import { api } from "../api/client";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useI18n, type TKey } from "../i18n";

const NAV: { to: string; key: TKey; icon: typeof Home; roles?: Role[] }[] = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/requests", key: "nav.requests", icon: ClipboardList },
  { to: "/team", key: "nav.team", icon: Users, roles: ["manager", "hr"] },
  { to: "/academy", key: "nav.academy", icon: GraduationCap },
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

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, key, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
              isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
            }`}
        >
          <Icon size={18} /> {t(key)}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
        <Logo />
        <div className="mt-6 flex-1">{nav}</div>
        <UserBox name={user.employee.full_name} role={t(`role.${user.role}`)} onLogout={() => { logout(); navigate("/login"); }} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Logo /><button onClick={() => setOpen(false)}><X /></button></div>
            <div className="mt-6 flex-1">{nav}</div>
            <UserBox name={user.employee.full_name} role={t(`role.${user.role}`)} onLogout={() => { logout(); navigate("/login"); }} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu /></button>
          <div className="lg:hidden"><Logo /></div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 text-xs font-semibold">
              {(["ru", "kz"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2 py-1 uppercase ${lang === l ? "bg-brand-600 text-white" : "text-gray-500"} first:rounded-l-lg last:rounded-r-lg`}>
                  {l}
                </button>
              ))}
            </div>
            <NavLink to="/notifications" className="relative rounded-xl p-2 hover:bg-gray-100" aria-label={t("nav.notifications")}>
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </NavLink>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-extrabold tracking-tight text-brand-600">JANA</span>
      <span className="text-xl font-extrabold tracking-tight text-ink">MEN</span>
    </div>
  );
}

function UserBox({ name, role, onLogout }: { name: string; role: string; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
        {name.split(" ").slice(0, 2).map((p) => p[0]).join("")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-gray-500">{role}</p>
      </div>
      <button onClick={onLogout} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Выйти">
        <LogOut size={18} />
      </button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useCountUp } from "../components/useCountUp";
import { Link } from "react-router-dom";
import { ArrowUpRight, Banknote, Bot, Palmtree } from "lucide-react";
import { api } from "../api/client";
import type { Enrollment, HRRequest, MotivationSummary, Notification } from "../api/types";
import { Coin, GoalCard } from "../components/Motivation";
import { useAuth } from "../auth/AuthContext";
import EmployeePass from "../components/EmployeePass";
import RequestRow from "../components/RequestRow";
import { Card, Empty, Ring, buttonClass, fmtDate, pluralRu } from "../components/ui";
import { useI18n } from "../i18n";

const isActive = (r: HRRequest) => r.status === "pending_manager" || r.status === "pending_hr";

export default function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [requests, setRequests] = useState<HRRequest[] | null>(null);
  const [courses, setCourses] = useState<Enrollment[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [mot, setMot] = useState<MotivationSummary | null>(null);

  useEffect(() => {
    api.requests("my").then(setRequests);
    api.myCourses().then(setCourses);
    api.notifications().then(setNotes);
    api.motivation().then(setMot).catch(() => setMot(null));
  }, []);

  if (!user) return null;
  const e = user.employee;
  const firstName = e.full_name.split(" ")[1] ?? e.full_name;
  const n = e.vacation_balance_days;
  const todayRaw = new Date().toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU", { weekday: "long", day: "numeric", month: "long" });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const shown = requests ? [...requests.filter(isActive), ...requests.filter((r) => !isActive(r))].slice(0, 4) : [];
  const activeCount = requests?.filter(isActive).length ?? 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-forest px-6 py-8 text-white sm:px-10 sm:py-10">
        <RouteBackdrop />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[14px] text-white/60">{today}</p>
            <h1 className="mt-3 font-display text-[34px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[52px]">
              {t("home.hello")},<br />{firstName}
            </h1>

            <div className="mt-8 flex items-end gap-4">
              <span className="font-display text-[88px] font-bold leading-[0.8] tracking-[-0.06em] text-signal tabular-nums sm:text-[112px]"><CountUp to={n} /></span>
              <span className="pb-1 text-[17px] leading-snug text-white/80">
                {lang === "kz" ? <>күн демалыс<br />қалды</> : <>{pluralRu(n, ["день", "дня", "дней"])} отпуска<br />в запасе</>}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <Link to="/requests/new?type=vacation"
                className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-[15px] font-semibold text-forest transition hover:brightness-105">
                <Palmtree size={18} /> {t("home.new_vacation")}
              </Link>
              <Link to="/requests/new?type=advance"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-[15px] font-medium text-white transition hover:bg-white/15">
                <Banknote size={18} /> {t("home.new_advance")}
              </Link>
              <Link to="/assistant"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-[15px] font-medium text-white transition hover:bg-white/15">
                <Bot size={18} /> {t("home.ask")}
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end lg:pr-4">
            <EmployeePass e={e} />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <Card
          title={<span className="flex items-center gap-3">{t("home.in_transit")}
            {activeCount > 0 && <span className="rounded-full bg-signal px-2.5 py-0.5 font-body text-xs font-bold text-forest">{activeCount}</span>}</span>}
          action={<Link to="/requests" className="text-sm font-semibold text-forest hover:underline">{t("common.all")}</Link>}>
          {requests === null ? <Empty>{t("common.loading")}</Empty> : shown.length === 0 ? (
            <Empty action={<Link to="/requests/new" className={buttonClass("primary")}>{t("requests.new")}</Link>}>
              {t("home.in_transit_empty")}
            </Empty>
          ) : (
            <div className="divide-y divide-line">{shown.map((r) => <RequestRow key={r.id} r={r} />)}</div>
          )}
        </Card>

        <Card title={t("home.notifications")}
          action={<Link to="/notifications" className="text-sm font-semibold text-forest hover:underline">{t("common.all")}</Link>}>
          {notes.length === 0 ? <Empty>{t("home.no_notes")}</Empty> : (
            <ol className="relative">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-line" aria-hidden />
              {notes.slice(0, 5).map((nt) => (
                <li key={nt.id} className="relative">
                  <Link to={nt.link ?? "/notifications"} className="flex gap-4 py-2.5 hover:text-forest">
                    <span className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white ${nt.is_read ? "bg-line" : "bg-signal"}`} />
                    <span className="min-w-0">
                      <span className={`block text-[14px] leading-snug ${nt.is_read ? "text-muted" : "font-medium"}`}>{nt.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{nt.body ? `${nt.body}, ` : ""}{fmtDate(nt.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {mot && (
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <GoalCard goal={mot.goal} compact />
          <Link to="/rewards" className="group flex flex-col justify-between rounded-[28px] bg-signal p-6 text-forest transition hover:brightness-105">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em]">Jana-коины</span>
            <span className="mt-2 flex items-center gap-2 font-display text-[44px] font-bold leading-none tracking-[-0.04em]"><Coin size={38} /> {mot.coins}</span>
            <span className="mt-3 flex items-center justify-between text-[13px] font-semibold">
              Магазин наград и благодарности
              <ArrowUpRight size={18} className="transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      )}

      <section>
        <div className="mb-4 mt-4 flex items-end justify-between">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{t("home.my_courses")}</h2>
          <Link to="/academy" className="text-sm font-semibold text-forest hover:underline">{t("common.all")}</Link>
        </div>
        {courses.length === 0 ? <Card><Empty>{t("home.no_courses")}</Empty></Card> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} to={`/academy/${c.course.id}`}
                className="group flex flex-col rounded-[24px] bg-white p-6 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-4">
                  <Ring value={c.progress} />
                  <ArrowUpRight size={20} className="text-muted transition group-hover:text-forest" />
                </div>
                <p className="mt-5 font-display text-[16px] font-semibold leading-snug">{c.course.title}</p>
                <p className="mt-2 line-clamp-2 text-[13px] text-muted">{c.course.description}</p>
                <p className="mt-4 text-xs font-medium text-muted">
                  {c.course.duration_min} мин{c.due_date ? `, пройти до ${fmtDate(c.due_date)}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


function RouteBackdrop() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path d="M-20 360 C 180 300, 260 120, 470 160 S 760 380, 1020 90" fill="none" stroke="rgb(255 255 255 / 0.10)" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" className="route-flow" />
      <path d="M-20 60 C 220 110, 380 20, 560 70 S 860 10, 1020 40" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" className="route-flow" />
      {[[470, 160], [760, 300], [180, 300]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="5" fill="rgb(242 194 48 / 0.35)" />
      ))}
    </svg>
  );
}

function CountUp({ to }: { to: number }) {
  return <>{useCountUp(to)}</>;
}

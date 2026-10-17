import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck, Check, ChevronRight, Handshake, Heart, Palmtree, Snowflake, Clock, Crown, Flag, Flame, Footprints, Library, Lock, Medal, Package, Route,
  Sparkles, Sprout, Target, Trophy, Truck, X, Zap,
} from "lucide-react";
import type { GameProfile, LeaderRow, Rewards, Track } from "../api/types";
import { api } from "../api/client";
import { useCountUp } from "./useCountUp";
import { fmtDate, pluralRu } from "./ui";

const BADGE_ICONS = {
  footprints: Footprints, package: Package, target: Target, zap: Zap, clock: Clock, flame: Flame,
  calendar: CalendarCheck, route: Route, books: Library, trophy: Trophy, heart: Heart, handshake: Handshake,
} as const;
const TRACK_ICONS = { sprout: Sprout, truck: Truck, crown: Crown, route: Route } as const;

export const badgeIcon = (key: string) => BADGE_ICONS[key as keyof typeof BADGE_ICONS] ?? Medal;
export const trackIcon = (key: string) => TRACK_ICONS[key as keyof typeof TRACK_ICONS] ?? Route;
const days = (n: number) => pluralRu(n, ["день", "дня", "дней"]);
const STATE_CLS: Record<string, string> = {
  active: "bg-signal text-forest", weekend: "bg-white/[0.04] border border-dashed border-white/15", vacation: "bg-[#2f7a4f] text-white/80",
  frozen: "bg-[#9ad0f5] text-forest", missed: "bg-white/10", today: "bg-white/10",
};
const STATE_LABEL: Record<string, string> = {
  active: "занимались", weekend: "выходной", vacation: "отпуск", frozen: "заморозка", missed: "пропуск", today: "сегодня",
};

function LevelRing({ level, progress }: { level: number; progress: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setP(progress), 80);
    return () => clearTimeout(t);
  }, [progress]);
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-signal)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] text-signal">{level}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-white/60">уровень</span>
      </div>
    </div>
  );
}

export function GameHero({ g }: { g: GameProfile }) {
  const xp = useCountUp(g.xp);
  const earned = g.badges.filter((b) => b.earned_at).length;
  const left = g.level.xp_to !== null ? g.level.xp_to - g.xp : 0;
  return (
    <section className="relative overflow-hidden rounded-[32px] bg-forest px-6 py-7 text-white sm:px-9 sm:py-8">
      <svg className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 text-white/[0.04]" viewBox="0 0 100 100" aria-hidden>
        <path d="M50 5 61 38h35L68 58l11 34-29-21-29 21 11-34L4 38h35z" fill="currentColor" />
      </svg>
      <div className="relative grid items-center gap-7 lg:grid-cols-[auto_1fr_300px]">
        <LevelRing level={g.level.level} progress={g.level.progress} />

        <div className="min-w-0">
          <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-signal">Ваш уровень</p>
          <p className="mt-1 font-display text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px]">{g.level.title}</p>
          <p className="mt-1 text-white/70"><b className="font-display text-[22px] text-white tabular-nums">{xp}</b> XP
            <span className="ml-3 rounded-full bg-white/10 px-2.5 py-0.5 text-[12px]">+{g.xp_week} за неделю</span></p>
          <div className="mt-4 max-w-lg">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="bar-grow h-full rounded-full bg-[linear-gradient(90deg,#f2c230,#f7d66a)]" style={{ width: `${g.level.progress}%` }} />
            </div>
            <p className="mt-2 text-[13px] text-white/60">
              {g.level.next_title ? <>Ещё <b className="text-white">{left} XP</b> до уровня «{g.level.next_title}»</> : "Максимальный уровень. Вы легенда!"}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-white/70">
            {[["Урок", 10], ["Курс", 50], ["Тест на 100%", 25], ["С первой попытки", 15], ["Раньше срока", 20], ["Серия", "5/день"]].map(([l, v]) => (
              <span key={l} className="rounded-full border border-white/10 px-2.5 py-1">{l} <b className="text-signal">+{v}</b></span>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] bg-white/[0.07] p-5">
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${g.streak.current ? "bg-signal text-forest" : "bg-white/10 text-white/50"}`}>
              <Flame size={26} className={g.streak.current ? "flame" : ""} />
            </span>
            <div>
              <p className="font-display text-[24px] font-bold leading-none">{g.streak.current} {days(g.streak.current)}</p>
              <p className="mt-1 text-[12px] text-white/60">серия подряд · рекорд {g.streak.best}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-between gap-1">
            {g.streak.days.map((d, i) => (
              <span key={d.date} title={`${fmtDate(d.date)}: ${STATE_LABEL[d.state]}`}
                className={`flex h-6 flex-1 items-center justify-center rounded-md ${STATE_CLS[d.state]} ${i === g.streak.days.length - 1 ? "ring-2 ring-white/60 ring-offset-2 ring-offset-forest" : ""}`}>
                {d.state === "frozen" && <Snowflake size={11} />}
                {d.state === "vacation" && <Palmtree size={11} />}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-snug text-white/70">
            {g.streak.today ? "Сегодня вы уже занимались — серия продолжается."
              : g.streak.rest_today ? "Сегодня выходной — серия не сгорит. Отдыхайте!"
              : g.streak.current ? "Пройдите урок сегодня, чтобы продлить серию и получить бонус."
              : "Пройдите урок сегодня и начните серию."}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-white/55">
            <Snowflake size={12} className="text-[#9ad0f5]" />
            {g.streak.freeze_available ? "Заморозка на этой неделе доступна: один пропуск не сбросит серию" : "Заморозка этой недели уже использована"}
          </p>
          <p className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[12px] text-white/70">
            <Medal size={15} className="text-signal" /> Бейджей: <b className="text-white">{earned} из {g.badges.length}</b>
            <Link to="/rewards" className="ml-auto inline-flex items-center gap-1 rounded-full bg-signal px-2.5 py-1 font-semibold text-forest hover:brightness-105">
              {g.coins} коинов <ChevronRight size={13} />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export function TrackRoute({ t, dark }: { t: Track; dark?: boolean }) {
  const current = t.steps.findIndex((s) => s.status !== "completed" && !s.locked);
  return (
    <div className="relative flex items-center pt-7">
      {t.steps.map((s, i) => {
        const done = s.status === "completed";
        const here = t.enrolled && i === current;
        return (
          <div key={s.order} className="relative flex flex-1 items-center">
            <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] text-[12px] font-bold ${
              done ? "border-brand-600 bg-brand-600 text-white"
                : here ? "route-current border-signal bg-forest text-signal"
                : s.locked ? `${dark ? "border-white/15 bg-white/5 text-white/40" : "border-line bg-paper text-muted"}`
                : `${dark ? "border-white/25 bg-forest text-white/80" : "border-line bg-white text-ink"} ${s.required ? "" : "border-dashed"}`}`}
              title={s.course.title}>
              {done ? <Check size={16} strokeWidth={3} /> : s.locked ? <Lock size={13} /> : i + 1}
              {here && (
                <span className="van-hop absolute -top-7 left-1/2 -translate-x-1/2 text-signal"><Truck size={20} /></span>
              )}
            </span>
            <span className={`h-[3px] flex-1 ${done ? "bg-brand-600" : dark ? "bg-[repeating-linear-gradient(90deg,rgb(255_255_255/.25)_0_6px,transparent_6px_11px)]" : "bg-[repeating-linear-gradient(90deg,var(--color-line)_0_6px,transparent_6px_11px)]"}`} />
          </div>
        );
      })}
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.progress.complete ? "bg-signal text-forest" : dark ? "bg-white/10 text-white/60" : "bg-signal-50 text-signal-ink"}`}>
        <Flag size={16} />
      </span>
    </div>
  );
}

export function TrackCard({ t, onJoin, busy }: { t: Track; onJoin?: (t: Track) => void; busy?: boolean }) {
  const Icon = trackIcon(t.icon);
  const done = !!t.completed_at;
  return (
    <div className={`flex min-w-0 flex-col rounded-[24px] p-6 ${t.enrolled ? "bg-white" : "bg-forest text-white"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${t.enrolled ? "bg-forest text-signal" : "bg-signal text-forest"}`}><Icon size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-bold leading-snug tracking-[-0.01em]">{t.title}</p>
          <p className={`text-[12px] ${t.enrolled ? "text-muted" : "text-white/60"}`}>{t.audience} · <b className={t.enrolled ? "text-signal-ink" : "text-signal"}>+{t.xp_reward} XP</b></p>
        </div>
      </div>
      <TrackRoute t={t} dark={!t.enrolled} />
      <p className={`mt-4 line-clamp-2 text-[13px] ${t.enrolled ? "text-muted" : "text-white/70"}`}>{t.description}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className={`text-[12px] font-medium ${t.enrolled ? "text-muted" : "text-white/60"}`}>
          {done ? `Пройдена ${fmtDate(t.completed_at!)}` : t.enrolled
            ? `${t.progress.required_done} из ${t.progress.required} обязательных · ${t.progress.progress}%${t.due_date ? ` · до ${fmtDate(t.due_date)}` : ""}`
            : `${t.steps.length} ${pluralRu(t.steps.length, ["курс", "курса", "курсов"])} · ${t.steps.reduce((s, x) => s + x.course.duration_min, 0)} мин`}
        </span>
        {t.enrolled ? (
          <Link to={`/academy/tracks/${t.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-forest-2">
            {done ? "Открыть" : "Продолжить"} <ChevronRight size={15} />
          </Link>
        ) : (
          <div className="flex gap-2">
            <Link to={`/academy/tracks/${t.id}`} className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold transition hover:bg-white/15">Подробнее</Link>
            {onJoin && <button disabled={busy} onClick={() => onJoin(t)}
              className="rounded-full bg-signal px-4 py-2 text-[13px] font-semibold text-forest transition hover:brightness-105 disabled:opacity-60">Начать</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function BadgeGrid({ badges }: { badges: GameProfile["badges"] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {badges.map((b) => {
        const Icon = badgeIcon(b.icon);
        const on = !!b.earned_at;
        return (
          <div key={b.code} title={b.description}
            className={`relative flex flex-col items-center rounded-[20px] px-2 py-4 text-center ${on ? "bg-signal-50" : "bg-paper"}`}>
            <span className={`relative flex h-12 w-12 items-center justify-center rounded-full ${on ? "badge-shine bg-signal text-forest shadow-[0_6px_16px_-6px_rgb(242_194_48/0.9)]" : "bg-line/70 text-muted/60"}`}>
              <Icon size={22} />
              {!on && <Lock size={12} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 text-muted" />}
            </span>
            <span className={`mt-2.5 text-[12.5px] font-semibold leading-tight ${on ? "" : "text-muted"}`}>{b.title}</span>
            <span className="mt-1 text-[11px] leading-snug text-muted">{on ? `получен ${fmtDate(b.earned_at!)}` : b.description}</span>
          </div>
        );
      })}
    </div>
  );
}

const MEDAL = ["bg-signal text-forest", "bg-[#d9dde3] text-ink", "bg-[#e7b98a] text-[#5a3410]"];

export function Leaderboard() {
  const [scope, setScope] = useState<"team" | "company">("team");
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    api.leaderboard(scope, period).then((r) => setRows(r.rows));
  }, [scope, period]);
  const me = rows?.find((r) => r.me);
  const ahead = me && me.rank > 1 ? rows![me.rank - 2] : null;
  const seg = (on: boolean) => `flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[11.5px] font-semibold transition ${on ? "bg-forest text-white" : "text-muted hover:text-ink"}`;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex rounded-full bg-paper p-1">
          <button className={seg(scope === "team")} onClick={() => setScope("team")}>Отдел</button>
          <button className={seg(scope === "company")} onClick={() => setScope("company")}>Компания</button>
        </div>
        <div className="flex rounded-full bg-paper p-1">
          <button className={seg(period === "week")} onClick={() => setPeriod("week")}>Неделя</button>
          <button className={seg(period === "all")} onClick={() => setPeriod("all")}>Всё время</button>
        </div>
      </div>
      {ahead && me && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-signal-50 px-3.5 py-2.5 text-[12.5px] text-signal-ink">
          <Zap size={14} className="shrink-0" /> Ещё <b>{ahead.xp - me.xp + 1} XP</b>, и вы обгоните {ahead.name.split(" ")[1] ?? ahead.name}
        </p>
      )}
      {me && me.rank === 1 && me.xp > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] text-brand-700"><Crown size={14} /> Вы на первом месте!</p>
      )}
      <ol className="mt-3 space-y-1">
        {rows === null ? <li className="py-6 text-center text-sm text-muted">Загрузка…</li> : rows.map((r) => (
          <li key={r.employee_id} className={`rise-in flex items-center gap-3 rounded-[16px] px-2.5 py-2 ${r.me ? "bg-signal-50 ring-1 ring-signal/60" : ""}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold ${r.rank <= 3 && r.xp > 0 ? MEDAL[r.rank - 1] : "text-muted"}`}>{r.rank}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest font-display text-[11px] font-bold text-signal">
              {r.name.split(" ").map((x) => x[0]).join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{r.name}{r.me && <span className="ml-1 text-[11px] font-medium text-signal-ink">(вы)</span>}</span>
              <span className="block truncate text-[11.5px] text-muted">ур. {r.level} · {r.level_title}{scope === "company" ? ` · ${r.department}` : ""}</span>
            </span>
            {r.streak > 0 && <span className="flex items-center gap-0.5 text-[12px] font-semibold text-signal-ink"><Flame size={13} />{r.streak}</span>}
            <span className="w-16 text-right font-display text-[14px] font-bold tabular-nums">{r.xp}<span className="ml-0.5 text-[10px] font-medium text-muted">XP</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const CONFETTI = ["#f2c230", "#3f9a2c", "#ffffff", "#f7d66a", "#c2412d", "#164a2d"];

export function RewardLayer({ rewards, onClose }: { rewards: Rewards | null; onClose: () => void }) {
  const big = !!rewards && (rewards.badges.length > 0 || !!rewards.level_up || rewards.tracks.length > 0);
  useEffect(() => {
    if (!rewards || big) return;
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [rewards, big, onClose]);
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 1.8 + Math.random() * 1.4,
    color: CONFETTI[i % CONFETTI.length], rot: Math.random() * 360, w: 6 + Math.random() * 6,
  })), [rewards]);
  if (!rewards) return null;
  if (!big) {
    return (
      <div className="xp-toast fixed bottom-6 right-6 z-[80] w-[300px] max-w-[calc(100vw-32px)] rounded-[22px] bg-forest p-4 text-white shadow-[0_20px_40px_-12px_rgb(15_58_34/0.6)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-[26px] font-bold text-signal"><Sparkles size={20} />+{rewards.xp} XP</span>
          <button onClick={onClose} aria-label="Закрыть" className="text-white/50 hover:text-white"><X size={16} /></button>
        </div>
        <ul className="mt-2 space-y-1 text-[12.5px] text-white/80">
          {rewards.items.map((i) => <li key={i.label} className="flex justify-between gap-3"><span className="truncate">{i.label}</span><b className="text-signal">+{i.xp}</b></li>)}
        </ul>
      </div>
    );
  }
  const badge = rewards.badges[0];
  const Icon = badge ? badgeIcon(badge.icon) : rewards.tracks.length ? Route : Trophy;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-forest/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span key={i} className="confetti absolute top-[-20px] block rounded-sm"
            style={{ left: `${p.left}%`, width: p.w, height: p.w * 1.6, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, rotate: `${p.rot}deg` }} />
        ))}
      </div>
      <div className="done-card relative w-full max-w-sm rounded-[32px] bg-white p-7 text-center" onClick={(e) => e.stopPropagation()}>
        <span className="badge-shine mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-signal text-forest shadow-[0_14px_30px_-10px_rgb(242_194_48/0.9)]">
          <Icon size={44} />
        </span>
        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-signal-ink">
          {rewards.tracks.length ? "Траектория пройдена" : rewards.level_up ? "Новый уровень" : "Новый бейдж"}
        </p>
        <p className="mt-1 font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">
          {rewards.tracks[0] ?? (rewards.level_up ? `${rewards.level_up.level}. ${rewards.level_up.title}` : badge?.title)}
        </p>
        {badge && <p className="mt-2 text-sm text-muted">{rewards.tracks.length || rewards.level_up ? `И бейдж «${badge.title}»` : badge.description}</p>}
        {rewards.level_up && (rewards.tracks.length > 0) && <p className="mt-1 text-sm text-muted">Новый уровень: {rewards.level_up.title}</p>}
        <p className="mt-4 font-display text-[34px] font-bold text-forest">+{rewards.xp} XP</p>
        <ul className="mt-2 space-y-1 text-left text-[12.5px] text-muted">
          {rewards.items.map((i) => <li key={i.label} className="flex justify-between gap-3"><span className="truncate">{i.label}</span><b className="text-forest">+{i.xp}</b></li>)}
        </ul>
        <button onClick={onClose} className="mt-6 w-full rounded-full bg-forest py-3.5 text-[15px] font-semibold text-white transition hover:bg-forest-2">Отлично!</button>
      </div>
    </div>
  );
}

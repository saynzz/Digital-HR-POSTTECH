import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cake, CalendarHeart, Car, Coffee, Flag, Gift, GraduationCap, Mail, PartyPopper, Search, Send, Shirt, ShieldCheck,
  Sparkles, Target, Truck, Users, Utensils,
} from "lucide-react";
import { api } from "../api/client";
import type { KudosItem, KudosValue, MotivationSummary, Person, Rewards, TeamGoal } from "../api/types";
import { Button, ErrorText, Field, Modal, fmtDate, inputCls, pluralRu } from "./ui";

const REWARD_ICONS = {
  coffee: Coffee, car: Car, utensils: Utensils, shirt: Shirt, calendar: CalendarHeart, cake: Cake,
  graduation: GraduationCap, gift: Gift,
} as const;
export const rewardIcon = (k: string) => REWARD_ICONS[k as keyof typeof REWARD_ICONS] ?? Gift;
export const REWARD_ICON_KEYS = Object.keys(REWARD_ICONS);

export const VALUE_STYLE: Record<KudosValue, { icon: typeof Sparkles; chip: string; bar: string }> = {
  open: { icon: Sparkles, chip: "bg-[#e3f0fb] text-[#1f5d8c]", bar: "bg-[#5aa3d8]" },
  reliable: { icon: ShieldCheck, chip: "bg-brand-50 text-brand-700", bar: "bg-brand-600" },
  result: { icon: Target, chip: "bg-signal-50 text-signal-ink", bar: "bg-signal" },
};

export function Coin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="11" fill="#f2c230" />
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#d9a514" strokeWidth="1.4" />
      <path d="M13.6 7v6.2c0 2-1.1 3.3-3.1 3.3-.9 0-1.6-.2-2.2-.6l.6-1.5c.4.3.9.4 1.4.4.9 0 1.3-.5 1.3-1.6V7h2z" fill="#0f3a22" />
    </svg>
  );
}

export function GoalCard({ goal, compact, onEdit, department }: { goal: TeamGoal | null; compact?: boolean; onEdit?: () => void; department?: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setP(goal?.percent ?? 0), 120);
    return () => clearTimeout(t);
  }, [goal?.percent]);
  if (!goal) {
    return (
      <div className="flex h-full flex-col justify-center rounded-[28px] border-2 border-dashed border-line bg-white p-6 text-center">
        <Target size={28} className="mx-auto text-muted" />
        <p className="mt-3 font-display text-[17px] font-bold">{department ? `${department}: общей цели пока нет` : "У отдела пока нет общей цели"}</p>
        <p className="mt-1 text-sm text-muted">Руководитель может поставить цель по XP и пообещать награду всему отделу.</p>
        {onEdit && <Button variant="dark" className="mx-auto mt-4" onClick={onEdit}><Target size={16} /> Поставить цель</Button>}
      </div>
    );
  }
  const left = Math.max(goal.target_xp - goal.total, 0);
  return (
    <div className={`relative overflow-hidden rounded-[28px] bg-white ${compact ? "p-5" : "p-6"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
            <Users size={14} /> Цель отдела · {goal.department}
          </p>
          <p className={`mt-1 font-display font-bold leading-tight tracking-[-0.02em] ${compact ? "text-[18px]" : "text-[22px]"}`}>{goal.title}</p>
        </div>
        {onEdit ? (
          <button onClick={onEdit} className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-[12px] font-semibold text-forest hover:bg-line">Изменить</button>
        ) : compact ? (
          <Link to="/rewards" className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-[12px] font-semibold text-forest hover:bg-line">Подробнее</Link>
        ) : null}
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-signal-50 px-3 py-1 text-[13px] font-semibold text-signal-ink">
        <Gift size={14} /> {goal.reward}
      </p>

      <div className="relative mt-7">
        <div className="relative h-11 rounded-full bg-forest">
          <span className="absolute inset-x-5 top-1/2 h-[3px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(242_194_48/0.6)_0_14px,transparent_14px_26px)]" />
          <span className="absolute inset-y-1 left-1 rounded-full bg-white/10 transition-[width] duration-[1400ms] ease-out" style={{ width: `calc(${p}% - 8px)` }} />
          {[25, 50, 75].map((m) => (
            <span key={m} className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${p >= m ? "bg-signal" : "bg-white/25"}`} style={{ left: `${m}%` }} />
          ))}
          <span className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-signal text-forest">
            {goal.achieved ? <PartyPopper size={16} /> : <Flag size={16} />}
          </span>
        </div>
        <span className="absolute -top-5 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-2xl bg-signal text-forest shadow-[0_8px_18px_-6px_rgb(242_194_48/0.9)] transition-[left] duration-[1400ms] ease-out"
          style={{ left: `clamp(24px, ${p}%, calc(100% - 64px))` }}>
          <Truck size={20} className={goal.achieved ? "" : "van-hop"} />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <p><span className="font-display text-[24px] font-bold tabular-nums">{goal.total}</span>
          <span className="text-sm text-muted"> / {goal.target_xp} XP · {goal.percent}%</span></p>
        <p className="text-[13px] text-muted">
          {goal.achieved ? <b className="text-brand-700">Цель достигнута!</b>
            : <>Ещё <b className="text-ink">{left} XP</b> · {goal.days_left} {pluralRu(goal.days_left, ["день", "дня", "дней"])} до {fmtDate(goal.end_date)}</>}
        </p>
      </div>
      {!compact && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-4">
          <div className="flex items-center">
            {goal.top.map((t, i) => (
              <span key={t.id} title={`${t.name}: ${t.xp} XP`} style={{ zIndex: 10 - i }}
                className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-forest font-display text-[11px] font-bold text-signal first:ml-0">
                {t.initials}
              </span>
            ))}
            <span className="ml-3 text-[12.5px] text-muted">{goal.top[0] ? `больше всех: ${goal.top[0].name}` : "пока никто не начал"}</span>
          </div>
          <span className="rounded-full bg-paper px-3 py-1.5 text-[12.5px] font-semibold">Ваш вклад: {goal.my_xp} XP</span>
        </div>
      )}
    </div>
  );
}

const PRESETS = ["Пицца-пятница для всего отдела", "Командный ужин", "Поход в кино всем отделом", "Командный мерч"];

export function GoalModal({ open, onClose, onSaved, department, departments, current }: {
  open: boolean; onClose: () => void; onSaved: (g: TeamGoal) => void;
  department?: string; departments?: string[]; current?: TeamGoal | null;
}) {
  const [dep, setDep] = useState(department ?? "");
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState("");
  const [target, setTarget] = useState("900");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDep(department ?? departments?.[0] ?? "");
    setTitle(current?.title ?? "Вместе к цели месяца");
    setReward(current?.reward ?? PRESETS[0]);
    setTarget(String(current?.target_xp ?? 900));
    setEnd(current?.end_date ?? d.toISOString().slice(0, 10));
    setError(null);
  }, [open, current, department, departments]);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.setGoal({ department: dep || undefined, title, reward, target_xp: Number(target), end_date: end }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Цель отдела"
      footer={<><Button variant="light" onClick={onClose}>Отмена</Button><Button variant="dark" disabled={busy || title.length < 3 || reward.length < 3} onClick={save}>Сохранить</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-muted">Весь отдел вместе копит XP: уроки, курсы, серии и благодарности. Когда цель достигнута, все получают уведомление.</p>
        {departments && (
          <Field label="Отдел">
            <select className={inputCls} value={dep} onChange={(e) => setDep(e.target.value)}>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
        )}
        <Field label="Название"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} /></Field>
        <Field label="Награда для отдела">
          <input className={inputCls} value={reward} onChange={(e) => setReward(e.target.value)} maxLength={255} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setReward(p)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${reward === p ? "bg-forest text-white" : "bg-paper hover:bg-line"}`}>{p}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Цель, XP"><input type="number" min={50} step={50} className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="До"><input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  );
}

export function KudosCard({ k }: { k: KudosItem }) {
  const st = VALUE_STYLE[k.value];
  return (
    <div className={`rise-in relative overflow-hidden rounded-[22px] bg-white p-4 pl-5 ${k.mine ? "ring-2 ring-signal" : ""}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${st.bar}`} />
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest font-display text-[10px] font-bold text-signal">{k.from.initials}</span>
        <span className="min-w-0 truncate"><b>{k.from.name}</b> <span className="text-muted">→</span> <b>{k.to.name}</b></span>
      </div>
      <p className="mt-2.5 text-[14px] leading-relaxed">«{k.message}»</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${st.chip}`}><st.icon size={12} /> {k.value_title}</span>
        <span className="text-[11px] text-muted">{k.mine ? "вам · " : ""}{fmtDate(k.created_at)}</span>
      </div>
    </div>
  );
}

const TEMPLATES = ["Спасибо, что выручил(а)!", "Отличная работа с клиентом", "Помог(ла) разобраться — очень ценю", "Без тебя бы не успели"];

export function KudosComposer({ summary, onSent }: { summary: MotivationSummary; onSent: (k: KudosItem, r: Rewards | null, left: number) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [to, setTo] = useState<Person | null>(null);
  const [value, setValue] = useState<KudosValue>("reliable");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  useEffect(() => { api.colleagues().then(setPeople); }, []);
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.department.toLowerCase().includes(q)).slice(0, 5);
  }, [people, query]);
  const left = summary.kudos_left;
  const send = async () => {
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.sendKudos(to.id, value, message.trim());
      setFlying(true);
      setTimeout(() => setFlying(false), 900);
      onSent(r.kudos, r.rewards, r.kudos_left);
      setTo(null);
      setQuery("");
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[28px] bg-forest p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-signal text-forest"><Mail size={22} /></span>
          <div>
            <p className="font-display text-[19px] font-bold leading-tight">Посылка благодарности</p>
            <p className="mt-1 text-[13px] text-white/65">Коллега получит +15 XP, вы +5 XP. Благодарность увидит команда.</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[12px]">{left} из {summary.kudos_per_week} на неделе</span>
      </div>

      {flying && <Mail size={28} className="kudos-fly absolute right-10 top-24 text-signal" />}

      <div className="mt-5 space-y-4">
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-signal">Кому</p>
          {to ? (
            <div className="flex items-center gap-3 rounded-[18px] bg-white/10 p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal font-display text-[12px] font-bold text-forest">{to.initials}</span>
              <span className="min-w-0 flex-1"><b className="block truncate">{to.name}</b><span className="block truncate text-[12px] text-white/60">{to.position} · {to.department}</span></span>
              <button onClick={() => setTo(null)} className="text-[12px] font-semibold text-signal hover:underline">Изменить</button>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white/10 p-1.5">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Имя или отдел"
                  className="w-full rounded-[14px] bg-transparent py-2.5 pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-white/40" />
              </div>
              {found.map((p) => (
                <button key={p.id} onClick={() => setTo(p)} className="flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition hover:bg-white/10">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-display text-[10px] font-bold">{p.initials}</span>
                  <span className="min-w-0"><span className="block truncate text-[13.5px] font-medium">{p.name}</span><span className="block truncate text-[11.5px] text-white/50">{p.department}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-signal">За что</p>
          <div className="grid grid-cols-3 gap-2">
            {summary.values.map((v) => {
              const Icon = VALUE_STYLE[v.code].icon;
              return (
                <button key={v.code} onClick={() => setValue(v.code)} title={v.hint}
                  className={`flex flex-col items-center gap-1 rounded-[16px] px-2 py-3 text-[12.5px] font-semibold transition ${
                    value === v.code ? "bg-signal text-forest" : "bg-white/10 text-white hover:bg-white/15"}`}>
                  <Icon size={18} /> {v.title}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={3}
            placeholder="Напишите пару слов: за что спасибо?"
            className="w-full resize-none rounded-[18px] bg-white px-4 py-3 text-[14px] text-ink outline-none" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button key={t} onClick={() => setMessage(t)} className="rounded-full border border-white/15 px-3 py-1 text-[11.5px] text-white/80 hover:bg-white/10">{t}</button>
            ))}
          </div>
        </div>

        {error && <p className="rounded-2xl bg-danger-50 px-4 py-2.5 text-sm text-danger">{error}</p>}
        <button onClick={send} disabled={!to || message.trim().length < 3 || busy || left <= 0}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-signal py-3.5 text-[15px] font-semibold text-forest transition hover:brightness-105 disabled:opacity-40">
          <Send size={17} /> {left <= 0 ? "Лимит на неделю исчерпан" : "Отправить благодарность"}
        </button>
      </div>
    </div>
  );
}

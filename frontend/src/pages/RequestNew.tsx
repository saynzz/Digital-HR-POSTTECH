import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Banknote, Palmtree, Send } from "lucide-react";
import { api } from "../api/client";
import type { RequestType } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import DeliveryScene, { type VanPhase } from "../components/DeliveryVan";
import { Card, ErrorText, Field, PageHeader, fmtMoney, inputCls, pluralRu } from "../components/ui";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const AMOUNTS = [25000, 50000, 100000, 150000];

export default function RequestNew() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [type, setType] = useState<RequestType>(params.get("type") === "advance" ? "advance" : "vacation");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<VanPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const today = iso(new Date());
  const balance = user?.employee.vacation_balance_days ?? 0;
  const days = useMemo(() => {
    if (!start || !end) return 0;
    const d = (new Date(end).getTime() - new Date(start).getTime()) / 86400000 + 1;
    return d > 0 ? Math.round(d) : 0;
  }, [start, end]);

  if (!user) return null;
  const e = user.employee;
  const busy = phase !== "idle" && phase !== "error";

  const problem = type === "vacation"
    ? !start || !end ? "Укажите даты отпуска"
      : start < today ? "Дата начала уже прошла"
      : days <= 0 ? "Дата окончания раньше даты начала"
      : days > balance ? `Доступно только ${balance} ${pluralRu(balance, ["день", "дня", "дней"])}`
      : null
    : !amount || Number(amount) <= 0 ? "Укажите сумму аванса" : null;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (problem || busy) return;
    setError(null);
    setPhase("loading");
    const fast = reduced();
    try {
      const data = type === "vacation"
        ? { start_date: start, end_date: end, comment: comment || null }
        : { amount: Number(amount), comment: comment || null };
      const [created] = await Promise.all([api.createRequest(type, data), sleep(fast ? 0 : 700)]);
      setPhase("driving");
      await sleep(fast ? 300 : 1350);
      refresh();
      navigate(`/requests/${created.id}?sent=1`, { replace: true });
    } catch (err) {
      setPhase("error");
      setError((err as Error).message);
      await sleep(900);
      setPhase("idle");
    }
  };

  const route = [
    { label: "Вы", sub: e.full_name.split(" ").slice(0, 2).join(" ") },
    ...(e.manager ? [{ label: "Руководитель", sub: e.manager.full_name.split(" ").slice(0, 2).join(" ") }] : []),
    { label: "HR", sub: "Оформление" },
    { label: "1С:ЗУП", sub: "Приказ и документ" },
  ];

  return (
    <div>
      <PageHeader title="Новая заявка" subtitle="Заполните накладную — и заявка отправится по маршруту. Статус будет виден на каждом этапе." />

      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between bg-signal px-6 py-3">
            <span className="font-display text-[13px] font-bold tracking-[-0.01em] text-forest">НАКЛАДНАЯ · JANA POST</span>
            <span className="text-[12px] font-medium text-forest">{new Date().toLocaleDateString("ru-RU")}</span>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: "vacation", label: "Отпуск", hint: `${balance} ${pluralRu(balance, ["день", "дня", "дней"])} в запасе`, icon: Palmtree },
                { id: "advance", label: "Аванс", hint: "Выплата до зарплаты", icon: Banknote },
              ] as const).map(({ id, label, hint, icon: Icon }) => (
                <button key={id} type="button" disabled={busy} onClick={() => { setType(id); setError(null); }}
                  className={`flex flex-col items-start gap-2 rounded-[20px] border-2 p-3 text-left transition sm:flex-row sm:items-center sm:gap-3 sm:p-4 ${
                    type === id ? "border-forest bg-forest text-white" : "border-line bg-white hover:border-forest/40"}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11 ${
                    type === id ? "bg-signal text-forest" : "bg-paper text-forest"}`}>
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="block font-display text-[15px] font-semibold sm:text-[16px]">{label}</span>
                    <span className={`block text-xs ${type === id ? "text-white/70" : "text-muted"}`}>{hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {type === "vacation" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Первый день отпуска" required>
                  <input className={inputCls} type="date" min={today} value={start} disabled={busy}
                    onChange={(ev) => { setStart(ev.target.value); if (!end || ev.target.value > end) setEnd(ev.target.value); }} />
                </Field>
                <Field label="Последний день" required>
                  <input className={inputCls} type="date" min={start || today} value={end} disabled={busy}
                    onChange={(ev) => setEnd(ev.target.value)} />
                </Field>
                <div className="sm:col-span-2 flex items-center justify-between rounded-[20px] bg-paper px-5 py-4">
                  <div>
                    <p className="text-sm text-muted">Продолжительность</p>
                    <p className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">
                      {days} <span className="text-[16px] font-semibold text-muted">{pluralRu(days, ["день", "дня", "дней"])}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted">Останется</p>
                    <p className={`font-display text-[28px] font-bold leading-tight tracking-[-0.03em] ${balance - days < 0 ? "text-danger" : ""}`}>
                      {balance - days}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Сумма аванса, ₸" required>
                  <input className={inputCls} type="number" min={1} step={1} inputMode="numeric" value={amount}
                    disabled={busy} onChange={(ev) => setAmount(ev.target.value)} placeholder="Например, 50 000" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {AMOUNTS.map((a) => (
                    <button key={a} type="button" disabled={busy} onClick={() => setAmount(String(a))}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        Number(amount) === a ? "bg-forest text-white" : "bg-paper text-ink hover:bg-line"}`}>
                      {fmtMoney(a)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label="Комментарий" hint="Необязательно. Увидят руководитель и HR">
              <textarea className={`${inputCls} min-h-20`} value={comment} disabled={busy} maxLength={500}
                onChange={(ev) => setComment(ev.target.value)} placeholder="Например: семейная поездка" />
            </Field>
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24">
          <DeliveryScene phase={phase} type={type} label={type === "vacation" ? (days ? `${days} дн.` : "Отпуск") : "Аванс"} />

          <Card>
            <p className="mb-4 font-display text-[15px] font-semibold">Маршрут заявки</p>
            <ol className="relative space-y-4">
              <span className="absolute bottom-2 left-[7px] top-2 w-[2px] bg-[repeating-linear-gradient(180deg,var(--color-line)_0_5px,transparent_5px_9px)]" />
              {route.map((r, i) => (
                <li key={r.label} className="relative flex gap-4">
                  <span className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] ${i === 0 ? "border-signal bg-forest" : "border-line bg-white"}`} />
                  <span>
                    <span className="block text-[14px] font-semibold">{r.label}</span>
                    <span className="block text-xs text-muted">{r.sub}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <ErrorText>{error}</ErrorText>
          {!error && problem && phase === "idle" && <p className="px-2 text-sm text-muted">{problem}</p>}

          <button type="submit" disabled={!!problem || busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-forest px-6 py-4 text-[16px] font-semibold text-white transition hover:bg-forest-2 disabled:opacity-40">
            {phase === "loading" ? "Грузим в фургон…" : phase === "driving" ? <>В пути <ArrowRight size={18} /></> : <><Send size={18} /> Отправить заявку</>}
          </button>
        </div>
      </form>
    </div>
  );
}

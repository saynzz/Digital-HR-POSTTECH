import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, ChevronRight, Download, Info, Lightbulb, OctagonAlert, TerminalSquare } from "lucide-react";
import { api } from "../api/client";
import type { Report, ReportBlock, Tone } from "../api/types";

type Act = { onCommand: (cmd: string) => void; onInsert: (text: string) => void };
type Of<T extends ReportBlock["type"]> = Extract<ReportBlock, { type: T }>;

const toneText: Record<string, string> = {
  good: "text-brand-700", warn: "text-signal-ink", bad: "text-danger", muted: "text-muted", brand: "text-forest",
};
const toneChip: Record<string, string> = {
  good: "bg-brand-50 text-brand-700", warn: "bg-signal-50 text-signal-ink", bad: "bg-danger-50 text-danger",
  muted: "bg-gray-100 text-muted", brand: "bg-forest text-white",
};
const toneFill: Record<string, string> = { good: "bg-brand-600", warn: "bg-signal", bad: "bg-danger", muted: "bg-line", brand: "bg-forest" };
const tt = (t: Tone) => (t ? toneText[t] : "");

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const fmtD = (iso: string, year = true) =>
  day(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).replace(" г.", "");
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(".", ",")}м` : v >= 1000 ? `${Math.round(v / 1000)}к` : String(v));

function Section({ title, children, aside }: { title?: string | null; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rise-in">
      {(title || aside) && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          {title && <h4 className="font-display text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</h4>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function Person({ b }: { b: Of<"person"> }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-forest p-5 text-white">
      <svg className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-white/5" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="10" />
      </svg>
      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-signal font-display text-lg font-bold text-forest">{b.initials}</span>
        <div className="min-w-0">
          <p className="font-display text-[20px] font-bold leading-tight tracking-[-0.02em]">{b.full_name}</p>
          <p className="mt-0.5 text-sm text-white/70">{b.position} · {b.department}</p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full bg-white/10 px-3 py-1">Стаж <b className="text-signal">{b.tenure}</b></span>
        <span className="rounded-full bg-white/10 px-3 py-1">В компании с {fmtD(b.hire_date)}</span>
        {b.manager && <span className="rounded-full bg-white/10 px-3 py-1">Руководитель: {b.manager}</span>}
        <span className="rounded-full bg-white/10 px-3 py-1">Доступ в Jana Hub: {b.account}</span>
      </div>
    </div>
  );
}

function Stats({ b }: { b: Of<"stats"> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {b.items.map((s) => (
        <div key={s.label} className="rounded-[18px] bg-paper px-4 py-3">
          <p className="text-[11px] font-medium text-muted">{s.label}</p>
          <p className={`mt-1 font-display text-[19px] font-bold leading-tight tracking-[-0.02em] ${tt(s.tone)}`}>{s.value}</p>
          {s.hint && <p className="mt-1 text-[11px] leading-snug text-muted">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function Bars({ b, act }: { b: Of<"bars">; act: Act }) {
  const max = Math.max(1, ...b.items.map((i) => i.value));
  if (!b.items.length || b.items.every((i) => !i.value)) {
    return <Section title={b.title}><p className="rounded-[18px] bg-paper px-4 py-3 text-sm text-muted">{b.empty}</p></Section>;
  }
  if (b.orientation === "vertical") {
    return (
      <Section title={b.title}>
        <div className="rounded-[18px] bg-paper px-3 pb-2 pt-4">
          <div className="flex h-36 items-end gap-1.5">
            {b.items.map((i, k) => (
              <div key={i.label} className="flex h-full flex-1 flex-col items-center justify-end" title={`${i.label}: ${i.display || "0"}`}>
                {i.value > 0 && <span className="mb-1 text-[9px] font-semibold text-forest">{compact(i.value)}</span>}
                <span className={`bar-rise w-full max-w-7 rounded-t-md ${i.value ? "bg-forest" : "bg-line"}`}
                  style={{ height: `${Math.max(i.value / max * 100, i.value ? 6 : 2)}%`, animationDelay: `${k * 40}ms` }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {b.items.map((i) => <span key={i.label} className="flex-1 text-center text-[9px] leading-tight text-muted">{i.label}</span>)}
          </div>
        </div>
      </Section>
    );
  }
  return (
    <Section title={b.title}>
      <div className="space-y-2.5 rounded-[18px] bg-paper p-4">
        {b.items.map((i, k) => (
          <div key={i.label} className="grid grid-cols-[minmax(70px,130px)_1fr_auto] items-center gap-3 text-[13px]">
            {i.cmd ? (
              <button onClick={() => act.onCommand(i.cmd!)} className="truncate text-left font-medium hover:text-forest hover:underline">{i.label}</button>
            ) : <span className="truncate font-medium">{i.label}</span>}
            <span className="h-2.5 overflow-hidden rounded-full bg-white">
              <span className={`bar-grow block h-full rounded-full ${i.tone ? toneFill[i.tone] : "bg-forest"}`}
                style={{ width: `${i.value / max * 100}%`, animationDelay: `${k * 50}ms` }} />
            </span>
            <span className={`min-w-14 text-right tabular-nums text-muted ${tt(i.tone)}`}>{i.display ?? i.value}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Table({ b, act }: { b: Of<"table">; act: Act }) {
  const navigate = useNavigate();
  return (
    <Section title={b.title}>
      {b.rows.length === 0 ? <p className="rounded-[18px] bg-paper px-4 py-3 text-sm text-muted">{b.empty}</p> : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                {b.columns.map((c) => (
                  <th key={c.label} className={`border-b border-line px-3 pb-2 text-[11px] font-medium text-muted ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, k) => {
                const go = r.cmd ? () => act.onCommand(r.cmd!) : r.link ? () => navigate(r.link!) : undefined;
                return (
                  <tr key={k} onClick={go} className={`group ${go ? "cursor-pointer" : ""}`}>
                    {r.cells.map((c, j) => (
                      <td key={j} className={`border-b border-dashed border-line px-3 py-2.5 transition group-hover:bg-paper ${
                        b.columns[j]?.align === "right" ? "text-right tabular-nums" : ""} ${j === 0 ? "font-semibold" : ""}`}>
                        {c.tone && c.tone !== "muted" && j > 0 ? (
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium ${c.text.length <= 14 ? "whitespace-nowrap" : ""} ${toneChip[c.tone]}`}>{c.text}</span>
                        ) : (
                          <span className={`${tt(c.tone)} ${j === 0 && go ? "group-hover:text-forest group-hover:underline" : ""}`}>{c.text}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const LEVEL = {
  high: { label: "Важно", icon: OctagonAlert, bar: "bg-danger", chip: "bg-danger-50 text-danger" },
  medium: { label: "Внимание", icon: AlertTriangle, bar: "bg-signal", chip: "bg-signal-50 text-signal-ink" },
  info: { label: "К сведению", icon: Info, bar: "bg-forest/40", chip: "bg-gray-100 text-muted" },
};

function Signals({ b, act }: { b: Of<"signals">; act: Act }) {
  const navigate = useNavigate();
  return (
    <Section title={b.title} aside={b.items.length ? <span className="text-xs text-muted">{b.items.length + b.more}</span> : null}>
      {b.items.length === 0 ? (
        <p className="rounded-[18px] bg-brand-50 px-4 py-3 text-sm text-brand-700">{b.empty}</p>
      ) : (
        <ul className="space-y-2">
          {b.items.map((s, k) => {
            const L = LEVEL[s.level];
            return (
              <li key={k} className="relative overflow-hidden rounded-[18px] border border-line bg-white py-3 pl-5 pr-4">
                <span className={`absolute inset-y-0 left-0 w-1.5 ${L.bar}`} />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${L.chip}`}><L.icon size={12} />{L.label}</span>
                  {s.cmd ? (
                    <button onClick={() => act.onCommand(s.cmd!)} className="text-[13px] font-semibold hover:text-forest hover:underline">{s.who}</button>
                  ) : <span className="text-[13px] font-semibold">{s.who}</span>}
                </div>
                <p className="mt-1.5 text-[14px] font-medium leading-snug">{s.text}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-muted">
                  <ArrowRight size={13} className="mt-0.5 shrink-0" />{s.action}
                </p>
                {s.link && (
                  <button onClick={() => navigate(s.link!)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-forest hover:underline">
                    Открыть <ChevronRight size={13} />
                  </button>
                )}
              </li>
            );
          })}
          {b.more > 0 && <li className="px-2 text-xs text-muted">и ещё {b.more}</li>}
        </ul>
      )}
    </Section>
  );
}

function Timeline({ b }: { b: Of<"timeline"> }) {
  const navigate = useNavigate();
  const dot: Record<string, string> = { good: "bg-brand-600", warn: "bg-signal", bad: "bg-danger", muted: "bg-line", brand: "bg-forest" };
  return (
    <Section title={b.title}>
      <ol className="relative space-y-1 rounded-[18px] bg-paper p-4">
        <span className="absolute bottom-6 left-[27px] top-6 w-[2px] bg-[repeating-linear-gradient(180deg,var(--color-line)_0_5px,transparent_5px_9px)]" />
        {b.items.map((e, k) => (
          <li key={k}>
            <button disabled={!e.link} onClick={() => e.link && navigate(e.link)}
              className="relative flex w-full items-start gap-3 rounded-2xl px-1.5 py-1.5 text-left transition enabled:hover:bg-white">
              <span className={`relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-paper ${e.tone ? dot[e.tone] : "bg-line"}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[13.5px] font-semibold">{e.title}</span>
                  <span className="text-[11px] tabular-nums text-muted">{fmtD(e.date)}</span>
                </span>
                <span className="block text-[12px] text-muted">{e.sub}</span>
              </span>
            </button>
          </li>
        ))}
        {b.more > 0 && <li className="pl-8 pt-1 text-xs text-muted">и ещё {b.more} событий раньше</li>}
      </ol>
    </Section>
  );
}

function Gantt({ b, act }: { b: Of<"gantt">; act: Act }) {
  const navigate = useNavigate();
  const t0 = day(b.start).getTime();
  const span = (day(b.end).getTime() - t0) / 86400000 + 1;
  const pos = (iso: string) => Math.min(Math.max(((day(iso).getTime() - t0) / 86400000) / span * 100, 0), 100);
  const width = (s: string, e: string) => Math.max(pos(e) + 100 / span - pos(s), 100 / span);
  const months: { label: string; left: number }[] = [];
  const d = day(b.start);
  d.setDate(1);
  while (d <= day(b.end)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    months.push({ label: d.toLocaleDateString("ru-RU", { month: "long" }), left: pos(iso) });
    d.setMonth(d.getMonth() + 1);
  }
  const ROW = 40;
  return (
    <Section title={b.title}>
      <div className="overflow-x-auto rounded-[18px] bg-paper p-4">
        <div className="flex min-w-[560px]">
          <div className="w-[120px] shrink-0 pr-3">
            <div className="h-7" />
            {b.rows.map((r) => (
              <button key={r.name} onClick={() => act.onCommand(r.cmd)} style={{ height: ROW }}
                className="block w-full truncate text-left text-[13px] font-medium leading-[40px] hover:text-forest hover:underline">{r.name}</button>
            ))}
          </div>
          <div className="relative flex-1">
            <div className="relative h-7 text-[11px] capitalize text-muted">
              {months.map((m) => <span key={m.label} className="absolute top-0 whitespace-nowrap border-l border-line pl-1.5" style={{ left: `${m.left}%` }}>{m.label}</span>)}
            </div>
            <div className="relative">
              {b.overlaps.map((o, k) => (
                <span key={k} className="absolute inset-y-0 z-0 rounded-md border-x border-danger/40 bg-danger/10"
                  style={{ left: `${pos(o.start)}%`, width: `${width(o.start, o.end)}%` }} title={`Пересечение: ${o.names.join(", ")}`} />
              ))}
              {months.map((m) => <span key={m.label} className="absolute inset-y-0 border-l border-line/70" style={{ left: `${m.left}%` }} />)}
              <span className="absolute inset-y-[-6px] z-20 w-[2px] rounded-full bg-forest" style={{ left: `${pos(b.today)}%` }}>
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-forest px-1.5 py-px text-[9px] font-semibold text-signal">сегодня</span>
              </span>
              {b.rows.map((r, k) => (
                <div key={r.name} className="relative z-10" style={{ height: ROW }}>
                  <span className="absolute inset-x-0 top-1/2 h-px border-t border-dashed border-line" />
                  {r.bars.map((x) => (
                    <button key={x.start} onClick={() => navigate(x.link)}
                      className={`bar-grow absolute top-1/2 flex h-6 -translate-y-1/2 items-center justify-center overflow-hidden whitespace-nowrap rounded-full px-1.5 text-[10px] font-semibold shadow-sm transition hover:brightness-110 ${
                        x.status === "approved" ? "bg-forest text-white" : "gantt-pending text-forest"}`}
                      style={{ left: `${pos(x.start)}%`, width: `${width(x.start, x.end)}%`, animationDelay: `${k * 60}ms` }}
                      title={`${fmtD(x.start, false)} – ${fmtD(x.end, false)} · ${x.status === "approved" ? "оформлен" : "на согласовании"}`}>
                      {x.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-forest" />оформлен</span>
          <span className="flex items-center gap-1.5"><span className="gantt-pending h-2.5 w-5 rounded-full" />на согласовании</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm border-x border-danger/40 bg-danger/10" />пересечение</span>
        </div>
      </div>
      {b.overlaps.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {b.overlaps.map((o, k) => (
            <li key={k} className="flex items-start gap-2 rounded-[14px] bg-danger-50 px-3.5 py-2 text-[12.5px] text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span><b>{fmtD(o.start, false)}{o.start !== o.end ? ` – ${fmtD(o.end, false)}` : ""}</b>: одновременно отсутствуют {o.names.join(" и ")}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Notes({ b }: { b: Of<"notes"> }) {
  return (
    <Section title={b.title}>
      <ul className="space-y-1.5 rounded-[18px] bg-signal-50 p-4">
        {b.items.map((n) => (
          <li key={n} className="flex items-start gap-2 text-[13px] text-signal-ink"><Lightbulb size={14} className="mt-0.5 shrink-0" />{n}</li>
        ))}
      </ul>
    </Section>
  );
}

function Export({ b }: { b: Of<"export"> }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const run = async () => {
    setState("busy");
    try {
      await api.download(b.url, b.filename);
      setState("idle");
    } catch {
      setState("error");
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={run} disabled={state === "busy"}
        className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-line disabled:opacity-50">
        <Download size={16} /> {state === "busy" ? "Готовлю файл…" : b.label}
      </button>
      {state === "error" && <span className="text-sm text-danger">Не удалось скачать</span>}
    </div>
  );
}

function Commands({ b, act }: { b: Of<"commands">; act: Act }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {b.items.map((c) => (
        <button key={c.cmd} onClick={() => (c.run ? act.onCommand(c.run) : act.onInsert(`${c.cmd.split(" ")[0]} `))}
          className="flex items-start gap-3 rounded-[18px] bg-paper p-3.5 text-left transition hover:bg-line/60">
          <TerminalSquare size={18} className="mt-0.5 shrink-0 text-forest" />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-forest">{c.cmd}</span>
            <span className="block text-[13px] font-medium">{c.title}</span>
            {c.hint && <span className="block text-[12px] leading-snug text-muted">{c.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function ReportView({ report, ...act }: { report: Report } & Act) {
  return (
    <div className="space-y-5">
      {report.blocks.map((b, k) => {
        switch (b.type) {
          case "person": return <Person key={k} b={b} />;
          case "stats": return <Stats key={k} b={b} />;
          case "bars": return <Bars key={k} b={b} act={act} />;
          case "table": return <Table key={k} b={b} act={act} />;
          case "signals": return <Signals key={k} b={b} act={act} />;
          case "timeline": return <Timeline key={k} b={b} />;
          case "gantt": return <Gantt key={k} b={b} act={act} />;
          case "notes": return <Notes key={k} b={b} />;
          case "export": return <Export key={k} b={b} />;
          case "commands": return <Commands key={k} b={b} act={act} />;
          default: return null;
        }
      })}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUp, BarChart3, BookOpen, Bot, CalendarDays, Check, ClipboardCheck, Database, GraduationCap, HelpCircle,
  History, ShieldAlert, ShieldCheck, Sparkles, UserRound, UserSearch, Users, Wallet, Building2, UserPlus,
} from "lucide-react";
import { api } from "../api/client";
import type { AgentCommands, AskResponse } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import ReportView from "../components/ReportView";
import { PageHeader } from "../components/ui";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; question: string; res: AskResponse; escalated?: boolean }
  | { id: number; role: "error"; text: string };

const SUGGESTIONS = [
  "Сколько дней отпуска мне положено?",
  "Как оформить отпуск?",
  "Когда выплачивают аванс?",
  "Что делать, если заболел?",
  "Как получить справку с места работы?",
];

const ICONS: Record<string, typeof Bot> = {
  "/команда": Users, "/сотрудник": UserSearch, "/отпуска": CalendarDays, "/авансы": Wallet, "/обучение": GraduationCap,
  "/ждут": ClipboardCheck, "/риски": ShieldAlert, "/отделы": Building2, "/найм": UserPlus, "/журнал": History,
  "/я": BarChart3, "/помощь": HelpCircle,
};
const PERSON_CMD = /^\/(сотрудник|досье|профиль)\s+(.*)$/i;

let seq = 0;

export default function Assistant() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentCommands | null>(null);
  const [hl, setHl] = useState(0);
  const [menuClosed, setMenuClosed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLead = user?.role === "manager" || user?.role === "hr";

  useEffect(() => {
    api.agentCommands().then(setAgent).catch(() => setAgent({ commands: [], people: [] }));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, thinking]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (question.length < 2 || thinking) return;
    setText("");
    setMenuClosed(false);
    setMsgs((m) => [...m, { id: ++seq, role: "user", text: question }]);
    setThinking(question.startsWith("/") ? "Считаю по данным 1С:ЗУП, заявок и Academy…" : isLead ? "Разбираю вопрос…" : "Ищу в базе знаний…");
    try {
      const res = await api.ask(question);
      setMsgs((m) => [...m, { id: ++seq, role: "bot", question, res }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: ++seq, role: "error", text: (e as Error).message }]);
    } finally {
      setThinking(null);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setParams({}, { replace: true });
      ask(q);
    }
  }, []);

  const insert = (t: string) => {
    setText(t);
    setMenuClosed(false);
    setHl(0);
    inputRef.current?.focus();
  };

  const menu = useMemo(() => {
    if (!agent || menuClosed || !text.startsWith("/")) return [];
    const person = text.match(PERSON_CMD);
    if (person) {
      const q = person[2].trim().toLowerCase();
      return agent.people
        .filter((p) => !q || p.name.toLowerCase().includes(q))
        .slice(0, 6)
        .map((p) => ({ key: `p${p.id}`, label: p.name, hint: `${p.position} · ${p.department}`, cmd: `/сотрудник ${p.name}`, run: true, icon: UserRound }));
    }
    if (text.includes(" ")) return [];
    const q = text.toLowerCase();
    return agent.commands
      .filter((c) => c.cmd.startsWith(q))
      .map((c) => ({ key: c.cmd, label: c.arg ? `${c.cmd} ${c.arg}` : c.cmd, hint: `${c.title}${c.hint ? ` — ${c.hint}` : ""}`,
                     cmd: c.arg ? `${c.cmd} ` : c.cmd, run: !c.arg, icon: ICONS[c.cmd] ?? Bot }));
  }, [agent, text, menuClosed]);

  const pick = (i: number) => {
    const item = menu[i];
    if (!item) return;
    if (item.run) ask(item.cmd);
    else insert(item.cmd);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!menu.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => (h + 1) % menu.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => (h - 1 + menu.length) % menu.length); }
    else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      pick(Math.min(hl, menu.length - 1));
    } else if (e.key === "Escape") setMenuClosed(true);
  };

  const escalate = async (msg: Extract<Msg, { role: "bot" }>) => {
    await api.escalate(msg.question);
    setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...msg, escalated: true } : x)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(text);
  };

  const quick = (agent?.commands ?? []).filter((c) => c.cmd !== "/помощь" && c.cmd !== "/я");
  const firstPerson = agent?.people[0]?.name;

  return (
    <div className="flex min-h-[calc(100vh-72px-56px)] flex-col">
      <PageHeader title="AI Jana" subtitle={isLead
        ? "Отвечает по базе знаний и считает аналитику по вашим сотрудникам: с даты приёма и по сей день."
        : "Отвечает на HR-вопросы только по базе знаний компании и всегда показывает источник."} />

      <div className="flex-1 space-y-4 pb-4">
        {msgs.length === 0 && (
          <div className="relative overflow-hidden rounded-[32px] bg-forest px-6 py-8 text-white sm:px-10">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal text-forest"><Bot size={24} /></span>
              <div>
                <p className="font-display text-[20px] font-bold">Здравствуйте, {user?.employee.full_name.split(" ")[1]}!</p>
                <p className="text-sm text-white/70">{isLead
                  ? "Спросите про команду или наберите «/», чтобы увидеть команды."
                  : "Спросите про отпуск, аванс, больничный или справки."}</p>
              </div>
            </div>

            {isLead && quick.length > 0 && (
              <>
                <p className="mt-7 text-xs font-semibold uppercase tracking-[0.08em] text-signal">Аналитика {user?.role === "hr" ? "по компании" : "по команде"}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {quick.map((c) => {
                    const Icon = ICONS[c.cmd] ?? Bot;
                    return (
                      <button key={c.cmd} onClick={() => (c.arg ? insert(`${c.cmd} `) : ask(c.cmd))}
                        className="group flex items-start gap-3 rounded-[20px] bg-white/[0.07] p-3.5 text-left transition hover:bg-white/[0.13]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal/15 text-signal transition group-hover:bg-signal group-hover:text-forest"><Icon size={18} /></span>
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold">{c.title} <span className="font-normal text-white/45">{c.cmd}</span></span>
                          <span className="block text-[12px] leading-snug text-white/60">{c.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Кто давно не был в отпуске?", "Что ждёт моего решения?", ...(firstPerson ? [`Досье ${firstPerson}`] : [])].map((s) => (
                    <button key={s} onClick={() => ask(s)}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10">«{s}»</button>
                  ))}
                </div>
              </>
            )}

            <p className={`${isLead ? "mt-7" : "mt-6"} text-xs font-semibold uppercase tracking-[0.08em] text-signal`}>{isLead ? "База знаний" : "Частые вопросы"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(isLead ? SUGGESTIONS.slice(1, 4) : SUGGESTIONS).map((s) => (
                <button key={s} onClick={() => ask(s)}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20">{s}</button>
              ))}
              {!isLead && <button onClick={() => ask("/я")} className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-forest transition hover:brightness-105">Моя статистика</button>}
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs text-white/55">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              {isLead
                ? "Цифры считает система по данным 1С:ЗУП, заявок и Jana Academy, а не языковая модель. Видны только ваши сотрудники, каждый просмотр записывается в журнал доступа. AI Jana подсказывает, но не принимает кадровых решений."
                : "AI Jana не видит персональные данные коллег и не принимает кадровых решений. Если надёжного ответа нет — честно скажет и предложит передать вопрос в HR."}
            </p>
          </div>
        )}

        {msgs.map((m) => m.role === "user" ? (
          <div key={m.id} className="rise-in flex justify-end">
            <div className="flex max-w-[85%] items-end gap-2">
              <p className={`rounded-[22px] rounded-br-md bg-forest px-5 py-3 text-[15px] text-white ${m.text.startsWith("/") ? "font-semibold tracking-[-0.01em]" : ""}`}>{m.text}</p>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-muted"><UserRound size={16} /></span>
            </div>
          </div>
        ) : m.role === "error" ? (
          <p key={m.id} className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">{m.text}</p>
        ) : m.res.mode === "analytics" ? (
          <AnalyticsMessage key={m.id} res={m.res} onCommand={ask} onInsert={insert} />
        ) : (
          <div key={m.id} data-msg className="rise-in flex max-w-[92%] items-start gap-2 sm:max-w-[80%]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-signal text-forest"><Bot size={16} /></span>
            <div className={`min-w-0 rounded-[22px] rounded-tl-md px-5 py-4 ${m.res.found ? "bg-white" : "bg-signal-50"}`}>
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{m.res.answer}</p>

              {m.res.sources.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-dashed border-line pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Источник</p>
                  {m.res.sources.map((s) => (
                    <div key={`${s.doc_id}-${s.section}`} className="flex items-center gap-2.5 rounded-2xl bg-paper px-3 py-2">
                      <BookOpen size={15} className="shrink-0 text-forest" />
                      <span className="min-w-0 text-sm">
                        <span className="font-medium">{s.title}</span>
                        {s.section && <span className="text-muted"> — {s.section}</span>}
                      </span>
                    </div>
                  ))}
                  <p className="flex items-center gap-1.5 pt-1 text-[11px] text-muted">
                    {m.res.mode === "llm"
                      ? <><Sparkles size={12} /> Пересказ локальной моделью строго по источнику</>
                      : <><BookOpen size={12} /> Цитата из базы знаний</>}
                  </p>
                </div>
              )}

              {!!m.res.suggestions?.length && <Chips items={m.res.suggestions} onPick={ask} />}

              {!m.res.found && (
                m.escalated ? (
                  <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-700"><Check size={16} /> Вопрос передан в HR — ответ придёт на почту.</p>
                ) : (
                  <button onClick={() => escalate(m)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-2">
                    <UserRound size={15} /> Передать вопрос в HR
                  </button>
                )
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal text-forest"><Bot size={16} /></span>
            <span className="flex items-center gap-1 rounded-[22px] bg-white px-5 py-4">
              <span className="typing-dot h-2 w-2 rounded-full bg-forest" />
              <span className="typing-dot h-2 w-2 rounded-full bg-forest" />
              <span className="typing-dot h-2 w-2 rounded-full bg-forest" />
              <span className="ml-2 text-xs text-muted">{thinking}</span>
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-4">
        {menu.length > 0 && (
          <div className="rise-in mb-2 overflow-hidden rounded-[24px] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgb(15_58_34/0.45)]">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {PERSON_CMD.test(text) ? "Сотрудники" : "Команды"} <span className="font-normal normal-case tracking-normal">· ↑↓ выбрать, Tab — подставить, Esc — закрыть</span>
            </p>
            {menu.map((it, i) => (
              <button key={it.key} type="button" onMouseEnter={() => setHl(i)} onClick={() => pick(i)}
                className={`flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition ${i === hl ? "bg-paper" : ""}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${i === hl ? "bg-forest text-signal" : "bg-paper text-forest"}`}><it.icon size={16} /></span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{it.label}</span>
                  <span className="block truncate text-[12px] text-muted">{it.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2 rounded-full bg-white p-2 shadow-[0_10px_30px_-12px_rgb(15_58_34/0.35)]">
          {isLead && (
            <button type="button" onClick={() => insert("/")} aria-label="Команды"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper font-display text-lg font-bold text-forest transition hover:bg-line">/</button>
          )}
          <input ref={inputRef} value={text} maxLength={1000} onKeyDown={onKey}
            onChange={(e) => { setText(e.target.value); setHl(0); setMenuClosed(false); }}
            placeholder={isLead ? "Вопрос, имя сотрудника или «/» для команд…" : "Задайте HR-вопрос…"}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[15px] outline-none" />
          <button type="submit" disabled={!!thinking || text.trim().length < 2} aria-label="Отправить"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-white transition hover:bg-forest-2 disabled:opacity-40">
            <ArrowUp size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Chips({ items, onPick }: { items: string[]; onPick: (q: string) => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((s) => (
        <button key={s} onClick={() => onPick(s)}
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-forest transition hover:border-forest">{s}</button>
      ))}
    </div>
  );
}

function AnalyticsMessage({ res, onCommand, onInsert }: { res: AskResponse; onCommand: (q: string) => void; onInsert: (t: string) => void }) {
  return (
    <div data-msg className="rise-in flex items-start gap-2">
      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-signal text-forest sm:flex"><Bot size={16} /></span>
      <div className="min-w-0 flex-1 rounded-[26px] rounded-tl-md bg-white p-5 sm:p-6">
        {res.report && (
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-display text-[20px] font-bold tracking-[-0.02em]">{res.report.title}</h3>
            {res.report.subtitle && <span className="text-[13px] text-muted">{res.report.subtitle}</span>}
          </div>
        )}
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{res.answer}</p>

        {res.insight && (
          <div className="mt-4 rounded-[20px] border border-signal/50 bg-signal-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-signal-ink"><Sparkles size={13} /> Рекомендации AI Jana</p>
            <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed">{res.insight}</p>
            <p className="mt-2 text-[11px] text-muted">Сформулировано локальной моделью только по фактам ниже. Решение остаётся за вами.</p>
          </div>
        )}

        {res.report && <div className="mt-5"><ReportView report={res.report} onCommand={onCommand} onInsert={onInsert} /></div>}

        {res.sources.length > 0 && (
          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed border-line pt-3 text-[11.5px] text-muted">
            <Database size={13} className="text-forest" /> Данные:
            {res.sources.map((s, i) => <span key={s.doc_id}><b className="font-semibold text-ink">{s.title}</b>{s.section ? ` (${s.section})` : ""}{i < res.sources.length - 1 ? " ·" : ""}</span>)}
          </p>
        )}
        {!!res.suggestions?.length && <Chips items={res.suggestions} onPick={onCommand} />}
      </div>
    </div>
  );
}

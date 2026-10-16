import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, BookOpen, Bot, Check, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { api } from "../api/client";
import type { AskResponse } from "../api/types";
import { useAuth } from "../auth/AuthContext";
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

let seq = 0;

export default function Assistant() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, thinking]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (question.length < 2 || thinking) return;
    setText("");
    setMsgs((m) => [...m, { id: ++seq, role: "user", text: question }]);
    setThinking(true);
    try {
      const res = await api.ask(question);
      setMsgs((m) => [...m, { id: ++seq, role: "bot", question, res }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: ++seq, role: "error", text: (e as Error).message }]);
    } finally {
      setThinking(false);
    }
  };

  const escalate = async (msg: Extract<Msg, { role: "bot" }>) => {
    await api.escalate(msg.question);
    setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...msg, escalated: true } : x)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(text);
  };

  return (
    <div className="flex min-h-[calc(100vh-72px-56px)] flex-col">
      <PageHeader title="AI Jana" subtitle="Отвечает на HR-вопросы только по базе знаний компании и всегда показывает источник." />

      <div className="flex-1 space-y-4 pb-4">
        {msgs.length === 0 && (
          <div className="rounded-[32px] bg-forest px-6 py-8 text-white sm:px-10">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal text-forest"><Bot size={24} /></span>
              <div>
                <p className="font-display text-[20px] font-bold">Здравствуйте, {user?.employee.full_name.split(" ")[1]}!</p>
                <p className="text-sm text-white/70">Спросите про отпуск, аванс, больничный или справки.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20">{s}</button>
              ))}
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs text-white/55">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              AI Jana не видит персональные данные коллег и не принимает кадровых решений. Если надёжного ответа нет — честно скажет и предложит передать вопрос в HR.
            </p>
          </div>
        )}

        {msgs.map((m) => m.role === "user" ? (
          <div key={m.id} className="rise-in flex justify-end">
            <div className="flex max-w-[85%] items-end gap-2">
              <p className="rounded-[22px] rounded-br-md bg-forest px-5 py-3 text-[15px] text-white">{m.text}</p>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-muted"><UserRound size={16} /></span>
            </div>
          </div>
        ) : m.role === "error" ? (
          <p key={m.id} className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">{m.text}</p>
        ) : (
          <div key={m.id} className="rise-in flex max-w-[92%] items-start gap-2 sm:max-w-[80%]">
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
              <span className="ml-2 text-xs text-muted">Ищу в базе знаний…</span>
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="sticky bottom-4 flex items-center gap-2 rounded-full bg-white p-2 shadow-[0_10px_30px_-12px_rgb(15_58_34/0.35)]">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
          placeholder="Задайте HR-вопрос…" className="min-w-0 flex-1 bg-transparent px-4 py-2 text-[15px] outline-none" />
        <button type="submit" disabled={thinking || text.trim().length < 2} aria-label="Отправить"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-white transition hover:bg-forest-2 disabled:opacity-40">
          <ArrowUp size={20} />
        </button>
      </form>
    </div>
  );
}

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ClipboardCheck, Lock, Play, RotateCcw, Trophy } from "lucide-react";
import { api } from "../api/client";
import type { CourseDetail, Enrollment } from "../api/types";
import { Button, Card, Empty, ErrorText, ProgressBar } from "../components/ui";

function renderText(text: string): ReactNode {
  return text.split(/\n{2,}/).map((para, i) => (
    <p key={i} className="mb-4 last:mb-0">
      {para.split(/(\*\*[^*]+\*\*)/).map((chunk, j) =>
        chunk.startsWith("**") ? <b key={j}>{chunk.slice(2, -2)}</b> : <Fragment key={j}>{chunk}</Fragment>)}
    </p>
  ));
}

export default function CourseView() {
  const { id } = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [enr, setEnr] = useState<Enrollment | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    api.course(Number(id)).then((c) => {
      setCourse(c);
      setEnr(c.enrollment);
      const done = new Set(c.enrollment?.completed_lesson_ids ?? []);
      const firstOpen = c.lessons.findIndex((l) => !done.has(l.id));
      setStep(firstOpen === -1 ? c.lessons.length : firstOpen);
      setShowResult(c.enrollment?.score !== null && c.enrollment?.score !== undefined);
    }).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error && !course) return <Card className="mt-6"><Empty>{error}</Empty></Card>;
  if (!course) return <Card className="mt-6"><Empty>Загрузка…</Empty></Card>;

  const done = new Set(enr?.completed_lesson_ids ?? []);
  const hasQuiz = course.questions.length > 0;
  const total = course.lessons.length + (hasQuiz ? 1 : 0);
  const onQuiz = hasQuiz && step >= course.lessons.length;
  const lesson = course.lessons[Math.min(step, course.lessons.length - 1)];

  const run = async (fn: () => Promise<Enrollment>) => {
    setBusy(true);
    setError(null);
    try {
      const e = await fn();
      setEnr(e);
      return e;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    const e = await run(() => api.completeLesson(course.id, lesson.id));
    if (e) setStep(Math.min(step + 1, hasQuiz ? course.lessons.length : course.lessons.length - 1));
  };

  const submitQuiz = async () => {
    const e = await run(() => api.submitQuiz(course.id, answers));
    if (e) setShowResult(true);
  };

  return (
    <div className="space-y-6 pt-4">
      <Link to="/academy" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={16} /> Jana Academy
      </Link>

      <section className="rounded-[32px] bg-forest px-6 py-8 text-white sm:px-10">
        <p className="text-sm text-white/60">{course.duration_min} мин · {course.lessons.length} уроков{hasQuiz ? " и тест" : ""}</p>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[40px]">{course.title}</h1>
        <p className="mt-3 max-w-2xl text-white/75">{course.description}</p>
        {enr && (
          <div className="mt-6 max-w-md rounded-2xl bg-forest-2 p-4 [&_*]:!text-white/80">
            <ProgressBar value={enr.progress} status={enr.status} />
          </div>
        )}
      </section>

      {!enr ? (
        <Card>
          <Empty action={<Button variant="dark" disabled={busy} onClick={() => run(() => api.startCourse(course.id))}><Play size={16} /> Начать курс</Button>}>
            Курс ещё не начат. Прогресс будет сохраняться в вашем профиле.
          </Empty>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="!p-3 lg:sticky lg:top-24">
            <ol>
              {course.lessons.map((l, i) => (
                <li key={l.id}>
                  <StepButton active={step === i} done={done.has(l.id)} n={i + 1} onClick={() => { setStep(i); setShowResult(false); }}>
                    {l.title}
                  </StepButton>
                </li>
              ))}
              {hasQuiz && (
                <li>
                  <StepButton active={onQuiz} done={enr.status === "completed"} n={total} quiz
                    onClick={() => { setStep(course.lessons.length); setShowResult(enr.score !== null); }}>
                    Итоговый тест
                  </StepButton>
                </li>
              )}
            </ol>
          </Card>

          {!onQuiz ? (
            <Card className="rise-in" key={lesson.id}>
              <p className="text-sm font-medium text-muted">Урок {step + 1} из {course.lessons.length}</p>
              <h2 className="mt-1 font-display text-[24px] font-bold tracking-[-0.02em]">{lesson.title}</h2>
              <div className="mt-5 text-[16px] leading-relaxed">{renderText(lesson.content)}</div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <span className="text-sm text-muted">{done.has(lesson.id) ? "Урок пройден" : "Прочитайте и отметьте урок"}</span>
                <Button variant="dark" disabled={busy} onClick={done.has(lesson.id) ? () => setStep(step + 1) : complete}>
                  {done.has(lesson.id) ? "Дальше" : <><Check size={16} /> Урок пройден — дальше</>}
                </Button>
              </div>
              <ErrorText>{error}</ErrorText>
            </Card>
          ) : showResult && enr.score !== null ? (
            <Card className="rise-in">
              <div className="flex flex-col items-center py-6 text-center">
                <span className={`flex h-20 w-20 items-center justify-center rounded-[28px] ${
                  enr.status === "completed" ? "bg-signal text-forest" : "bg-danger-50 text-danger"}`}>
                  {enr.status === "completed" ? <Trophy size={36} /> : <RotateCcw size={34} />}
                </span>
                <p className="mt-5 font-display text-[56px] font-bold leading-none tracking-[-0.04em]">{enr.score}%</p>
                <p className="mt-3 font-display text-[20px] font-semibold">
                  {enr.status === "completed" ? "Курс пройден" : "Тест не сдан"}
                </p>
                <p className="mt-2 max-w-md text-sm text-muted">
                  {enr.status === "completed"
                    ? "Результат сохранён в вашем профиле, HR и руководитель видят прогресс."
                    : "Повторите уроки и попробуйте ещё раз — попыток сколько угодно."}
                </p>
                {enr.status !== "completed" && (
                  <Button variant="dark" className="mt-6" onClick={() => { setAnswers({}); setShowResult(false); }}>
                    <RotateCcw size={16} /> Пройти тест ещё раз
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <Card className="rise-in" title="Итоговый тест">
              {course.lessons.some((l) => !done.has(l.id)) && (
                <p className="mb-5 flex items-center gap-2 rounded-2xl bg-signal-50 px-4 py-3 text-sm text-signal-ink">
                  <Lock size={16} /> Сначала пройдите все уроки — так тест будет проще.
                </p>
              )}
              <div className="space-y-6">
                {course.questions.map((q, qi) => (
                  <fieldset key={q.id}>
                    <legend className="mb-3 font-semibold">{qi + 1}. {q.question}</legend>
                    <div className="grid gap-2">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className={`flex cursor-pointer items-center gap-3 rounded-[16px] border-2 px-4 py-3 transition ${
                          answers[q.id] === oi ? "border-forest bg-paper" : "border-line hover:border-forest/40"}`}>
                          <input type="radio" name={`q${q.id}`} className="accent-[var(--color-forest)]" checked={answers[q.id] === oi}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
                <span className="text-sm text-muted">Отвечено {Object.keys(answers).length} из {course.questions.length}</span>
                <Button variant="dark" disabled={busy || Object.keys(answers).length < course.questions.length} onClick={submitQuiz}>
                  <ClipboardCheck size={16} /> Проверить
                </Button>
              </div>
              <ErrorText>{error}</ErrorText>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function StepButton({ active, done, n, quiz, onClick, children }: {
  active: boolean; done: boolean; n: number; quiz?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left text-[14px] transition ${
        active ? "bg-forest text-white" : "hover:bg-paper"}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
        done ? "bg-brand-600 text-white" : active ? "bg-signal text-forest" : "bg-paper text-muted"}`}>
        {done ? <Check size={14} strokeWidth={3} /> : quiz ? <ClipboardCheck size={14} /> : n}
      </span>
      <span className={active ? "font-semibold" : ""}>{children}</span>
    </button>
  );
}

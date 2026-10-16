import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clock, Flag, Lock, Play, Trophy, Truck } from "lucide-react";
import { api } from "../api/client";
import type { Track } from "../api/types";
import { TrackRoute, trackIcon } from "../components/Game";
import { Card, Empty, fmtDate, pluralRu } from "../components/ui";

export default function TrackView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.track(Number(id)).then(setT).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return <Card className="mt-6"><Empty>{error}</Empty></Card>;
  if (!t) return <Card className="mt-6"><Empty>Загрузка…</Empty></Card>;

  const Icon = trackIcon(t.icon);
  const current = t.steps.findIndex((s) => s.status !== "completed" && !s.locked);
  const minutes = t.steps.reduce((s, x) => s + x.course.duration_min, 0);

  const join = async () => {
    setBusy(true);
    try {
      setT(await api.joinTrack(t.id));
    } finally {
      setBusy(false);
    }
  };

  const open = async (courseId: number, started: boolean) => {
    if (!started) await api.startCourse(courseId);
    navigate(`/academy/${courseId}`);
  };

  return (
    <div className="space-y-6 pt-4">
      <Link to="/academy" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={16} /> Jana Academy
      </Link>

      <section className="relative overflow-hidden rounded-[32px] bg-forest px-6 py-8 text-white sm:px-10">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-signal text-forest"><Icon size={28} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/60">Траектория · {t.audience}</p>
            <h1 className="mt-1 font-display text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[40px]">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-white/75">{t.description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-full bg-white/10 px-3 py-1.5">{t.steps.length} {pluralRu(t.steps.length, ["курс", "курса", "курсов"])} · {minutes} мин</span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">Обязательных: {t.progress.required}</span>
          <span className="rounded-full bg-signal px-3 py-1.5 font-semibold text-forest">Награда: +{t.xp_reward} XP и бейдж</span>
          {t.due_date && <span className="rounded-full bg-white/10 px-3 py-1.5">Пройти до {fmtDate(t.due_date)}</span>}
        </div>
        <div className="mt-2 max-w-xl"><TrackRoute t={t} dark /></div>
        {t.enrolled ? (
          <p className="mt-4 text-[13px] text-white/70">
            {t.completed_at ? `Траектория пройдена ${fmtDate(t.completed_at)}` : `Пройдено ${t.progress.required_done} из ${t.progress.required} обязательных · ${t.progress.progress}%`}
          </p>
        ) : (
          <button onClick={join} disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 text-[15px] font-semibold text-forest transition hover:brightness-105 disabled:opacity-60">
            <Play size={17} /> Начать траекторию
          </button>
        )}
      </section>

      <ol className="relative mx-auto max-w-3xl">
        <span className="absolute bottom-10 left-[23px] top-10 w-[3px] bg-[repeating-linear-gradient(180deg,var(--color-line)_0_8px,transparent_8px_14px)]" />
        {t.steps.map((s, i) => {
          const done = s.status === "completed";
          const here = t.enrolled && i === current;
          const started = !!s.status && s.status !== "assigned";
          const prev = t.steps.slice(0, i).reverse().find((x) => x.required && x.status !== "completed");
          return (
            <li key={s.order} className="rise-in relative flex gap-5 pb-5" style={{ animationDelay: `${i * 80}ms` }}>
              <span className={`relative z-10 mt-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-paper font-display text-[15px] font-bold ${
                done ? "bg-brand-600 text-white" : here ? "route-current bg-signal text-forest" : s.locked ? "bg-line text-muted" : "bg-white text-forest"}`}>
                {done ? <Check size={20} strokeWidth={3} /> : here ? <Truck size={20} /> : s.locked ? <Lock size={16} /> : i + 1}
              </span>
              <div className={`flex-1 rounded-[24px] p-5 ${here ? "bg-white ring-2 ring-signal" : s.locked ? "bg-white/60" : "bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className={`rounded-full px-2.5 py-0.5 ${s.required ? "bg-forest text-white" : "border border-dashed border-line text-muted"}`}>
                    {s.required ? "Обязательный" : "По желанию"}
                  </span>
                  <span className="flex items-center gap-1 text-muted"><Clock size={12} /> {s.course.duration_min} мин</span>
                  {done && s.score !== null && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-brand-700">Тест {s.score}%</span>}
                  {here && <span className="rounded-full bg-signal-50 px-2.5 py-0.5 text-signal-ink">Следующая остановка</span>}
                </div>
                <p className={`mt-2 font-display text-[18px] font-bold leading-snug tracking-[-0.01em] ${s.locked ? "text-muted" : ""}`}>{s.course.title}</p>
                <p className="mt-1 text-[13px] text-muted">{s.course.description}</p>
                {started && !done && (
                  <div className="mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-forest" style={{ width: `${s.progress}%` }} />
                  </div>
                )}
                <div className="mt-4">
                  {s.locked ? (
                    <p className="flex items-center gap-2 text-[13px] text-muted"><Lock size={14} /> Откроется после курса «{prev?.course.title}»</p>
                  ) : t.enrolled ? (
                    <button onClick={() => open(s.course.id, !!s.status)}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition ${
                        done ? "bg-paper text-forest hover:bg-line" : "bg-forest text-white hover:bg-forest-2"}`}>
                      {done ? "Повторить материалы" : started ? "Продолжить" : <><Play size={15} /> Начать курс</>}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
        <li className="relative flex gap-5">
          <span className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-paper ${t.completed_at ? "bg-signal text-forest" : "bg-signal-50 text-signal-ink"}`}>
            {t.completed_at ? <Trophy size={20} /> : <Flag size={20} />}
          </span>
          <div className="flex-1 rounded-[24px] border-2 border-dashed border-signal/60 bg-signal-50 p-5">
            <p className="font-display text-[18px] font-bold">Финиш</p>
            <p className="mt-1 text-[13px] text-signal-ink">
              {t.completed_at ? "Маршрут пройден! Награда уже у вас." : `+${t.xp_reward} XP и бейдж «Маршрут пройден» за все обязательные курсы.`}
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}

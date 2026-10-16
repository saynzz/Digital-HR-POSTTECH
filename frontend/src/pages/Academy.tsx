import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Clock, Play } from "lucide-react";
import { api } from "../api/client";
import type { Course, Enrollment, EnrollmentStatus } from "../api/types";
import { Badge, Card, Empty, PageHeader, Ring, fmtDate } from "../components/ui";

const STATUS: Record<EnrollmentStatus, { label: string; tone: "gray" | "amber" | "green" | "red" }> = {
  assigned: { label: "Назначен", tone: "amber" },
  in_progress: { label: "В процессе", tone: "amber" },
  completed: { label: "Пройден", tone: "green" },
  failed: { label: "Тест не сдан", tone: "red" },
};

export default function Academy() {
  const navigate = useNavigate();
  const [mine, setMine] = useState<Enrollment[] | null>(null);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    api.myCourses().then(setMine);
    api.catalog().then(setCatalog);
  }, []);

  const mineIds = new Set((mine ?? []).map((e) => e.course.id));
  const others = catalog.filter((c) => !mineIds.has(c.id));
  const done = (mine ?? []).filter((e) => e.status === "completed").length;
  const avg = mine?.length ? Math.round(mine.reduce((s, e) => s + e.progress, 0) / mine.length) : 0;

  const start = async (c: Course) => {
    setStarting(c.id);
    try {
      await api.startCourse(c.id);
      navigate(`/academy/${c.id}`);
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Jana Academy" subtitle="Назначенные курсы, прогресс и каталог обучения компании." />

      {mine && mine.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Stat value={mine.length} label="Моих курсов" tone="bg-white text-ink" />
          <Stat value={done} label="Пройдено" tone="bg-forest text-white" />
          <Stat value={`${avg}%`} label="Средний прогресс" tone="bg-signal text-forest" />
        </div>
      )}

      <section>
        <h2 className="mb-4 font-display text-[22px] font-bold tracking-[-0.02em]">Мои курсы</h2>
        {mine === null ? <Card><Empty>Загрузка…</Empty></Card> : mine.length === 0 ? (
          <Card><Empty>Назначенных курсов нет. Выберите курс в каталоге ниже.</Empty></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((e) => (
              <Link key={e.id} to={`/academy/${e.course.id}`}
                className="group flex flex-col rounded-[24px] bg-white p-6 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-4">
                  <Ring value={e.progress} />
                  <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                </div>
                <p className="mt-5 font-display text-[16px] font-semibold leading-snug">{e.course.title}</p>
                <p className="mt-2 line-clamp-2 text-[13px] text-muted">{e.course.description}</p>
                <div className="mt-auto flex items-center justify-between pt-5 text-xs font-medium text-muted">
                  <span>{e.score !== null ? `Тест: ${e.score}%` : e.due_date ? `Пройти до ${fmtDate(e.due_date)}` : `${e.course.duration_min} мин`}</span>
                  <ArrowUpRight size={18} className="transition group-hover:text-forest" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-[22px] font-bold tracking-[-0.02em]">Каталог</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((c) => (
              <div key={c.id} className="flex flex-col rounded-[24px] bg-forest p-6 text-white">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-forest-2 px-3 py-1 text-xs text-white/80">
                  <Clock size={13} /> {c.duration_min} мин
                </span>
                <p className="mt-5 font-display text-[16px] font-semibold leading-snug">{c.title}</p>
                <p className="mt-2 line-clamp-3 text-[13px] text-white/70">{c.description}</p>
                <button onClick={() => start(c)} disabled={starting === c.id}
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-forest transition hover:brightness-105 disabled:opacity-60">
                  <Play size={15} /> Начать курс
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div className={`rounded-[24px] px-4 py-4 sm:px-6 sm:py-5 ${tone}`}>
      <p className="font-display text-[34px] font-bold leading-none tracking-[-0.04em] sm:text-[44px]">{value}</p>
      <p className="mt-2 text-[13px] font-medium opacity-75 sm:text-[14px]">{label}</p>
    </div>
  );
}

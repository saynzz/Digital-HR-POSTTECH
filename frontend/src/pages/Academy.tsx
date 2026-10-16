import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Clock, Play, Sparkles } from "lucide-react";
import { api } from "../api/client";
import type { Course, Enrollment, EnrollmentStatus, GameProfile, Track } from "../api/types";
import { BadgeGrid, GameHero, Leaderboard, TrackCard } from "../components/Game";
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
  const [tracks, setTracks] = useState<Track[]>([]);
  const [game, setGame] = useState<GameProfile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    api.myCourses().then(setMine);
    api.catalog().then(setCatalog);
    api.tracks().then(setTracks);
    api.game().then(setGame);
  };
  useEffect(load, []);

  const mineIds = new Set((mine ?? []).map((e) => e.course.id));
  const others = catalog.filter((c) => !mineIds.has(c.id));
  const myTracks = tracks.filter((t) => t.enrolled);
  const otherTracks = tracks.filter((t) => !t.enrolled);
  const active = (mine ?? []).filter((e) => e.status !== "completed");
  const finished = (mine ?? []).filter((e) => e.status === "completed");

  const start = async (c: Course) => {
    setBusy(`c${c.id}`);
    try {
      await api.startCourse(c.id);
      navigate(`/academy/${c.id}`);
    } finally {
      setBusy(null);
    }
  };

  const join = async (t: Track) => {
    setBusy(`t${t.id}`);
    try {
      await api.joinTrack(t.id);
      navigate(`/academy/tracks/${t.id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Jana Academy" subtitle="Траектории обучения, курсы, уровни и бейджи. Учитесь каждый день — серия растёт." />

      {game && <GameHero g={game} />}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          {myTracks.length > 0 && (
            <section>
              <SectionTitle>Мои траектории</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{myTracks.map((t) => <TrackCard key={t.id} t={t} />)}</div>
            </section>
          )}

          <section>
            <SectionTitle>Курсы в работе</SectionTitle>
            {mine === null ? <Card><Empty>Загрузка…</Empty></Card> : active.length === 0 ? (
              <Card><Empty>Все назначенные курсы пройдены. Выберите новую траекторию или курс ниже.</Empty></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{active.map((e) => <CourseCard key={e.id} e={e} />)}</div>
            )}
          </section>

          {otherTracks.length > 0 && (
            <section>
              <SectionTitle hint="Набор курсов по порядку. За прохождение — бонус XP и бейдж">Другие траектории</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {otherTracks.map((t) => <TrackCard key={t.id} t={t} onJoin={join} busy={busy === `t${t.id}`} />)}
              </div>
            </section>
          )}

          {finished.length > 0 && (
            <section>
              <SectionTitle>Пройденные курсы</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{finished.map((e) => <CourseCard key={e.id} e={e} />)}</div>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <SectionTitle>Каталог</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {others.map((c) => (
                  <div key={c.id} className="flex flex-col rounded-[24px] bg-forest p-6 text-white">
                    <span className="flex items-center justify-between">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-forest-2 px-3 py-1 text-xs text-white/80"><Clock size={13} /> {c.duration_min} мин</span>
                      <span className="whitespace-nowrap text-[11px] font-bold text-signal">+50 XP</span>
                    </span>
                    <p className="mt-5 hyphens-auto break-words font-display text-[16px] font-semibold leading-snug" lang="ru">{c.title}</p>
                    <p className="mt-2 line-clamp-3 text-[13px] text-white/70">{c.description}</p>
                    <button onClick={() => start(c)} disabled={busy === `c${c.id}`}
                      className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-forest transition hover:brightness-105 disabled:opacity-60">
                      <Play size={15} /> Начать курс
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24">
          <Card title="Рейтинг"><Leaderboard /></Card>
          {game && (
            <Card title="Бейджи" action={<span className="text-sm text-muted">{game.badges.filter((b) => b.earned_at).length}/{game.badges.length}</span>}>
              <BadgeGrid badges={game.badges} />
            </Card>
          )}
          {game && game.recent.length > 0 && (
            <Card title="Последние XP">
              <ul className="space-y-2">
                {game.recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 text-[13px]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-50 text-signal-ink"><Sparkles size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="block text-[11px] text-muted">{fmtDate(r.at)}</span>
                    </span>
                    <b className="text-forest">+{r.xp}</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{children}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

function CourseCard({ e }: { e: Enrollment }) {
  return (
    <Link to={`/academy/${e.course.id}`} className="group flex flex-col rounded-[24px] bg-white p-6 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-4">
        <Ring value={e.progress} />
        <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
      </div>
      <p className="mt-5 hyphens-auto break-words font-display text-[16px] font-semibold leading-snug" lang="ru">{e.course.title}</p>
      <p className="mt-2 line-clamp-2 text-[13px] text-muted">{e.course.description}</p>
      <div className="mt-auto flex items-center justify-between pt-5 text-xs font-medium text-muted">
        <span>{e.score !== null ? `Тест: ${e.score}%` : e.due_date ? `Пройти до ${fmtDate(e.due_date)}` : `${e.course.duration_min} мин`}</span>
        <ArrowUpRight size={18} className="transition group-hover:text-forest" />
      </div>
    </Link>
  );
}

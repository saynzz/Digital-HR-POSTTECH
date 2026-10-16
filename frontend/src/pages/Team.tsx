import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, GraduationCap, Search, UserSearch } from "lucide-react";
import { api } from "../api/client";
import type { Course, Employee, HRRequest } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import RequestRow from "../components/RequestRow";
import { Button, Card, Empty, ErrorText, Field, Modal, PageHeader, fmtDate, inputCls, pluralRu } from "../components/ui";

export default function Team() {
  const { user } = useAuth();
  const isHr = user?.role === "hr";
  const [people, setPeople] = useState<Employee[] | null>(null);
  const [queue, setQueue] = useState<HRRequest[] | null>(null);
  const [history, setHistory] = useState<HRRequest[]>([]);
  const [query, setQuery] = useState("");
  const [assignTo, setAssignTo] = useState<Employee | null>(null);
  const navigate = useNavigate();
  const agent = (q: string) => navigate(`/assistant?q=${encodeURIComponent(q)}`);

  useEffect(() => {
    api.team().then(setPeople);
    api.requests(isHr ? "all" : "team").then((rs) => {
      const waiting = isHr ? "pending_hr" : "pending_manager";
      setQueue(rs.filter((r) => r.status === waiting));
      setHistory(rs.filter((r) => r.status !== waiting).slice(0, 6));
    });
  }, [isHr]);

  if (!user) return null;
  const visible = (people ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    return p.id !== user.employee.id && (!q || [p.full_name, p.position, p.department].some((v) => v.toLowerCase().includes(q)));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={isHr ? "Сотрудники" : "Моя команда"}
        subtitle={isHr ? "Очередь на оформление и все сотрудники компании." : "Заявки, которые ждут вашего решения, и ваши подчинённые."}
        action={
          <button onClick={() => agent("/команда")}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-forest-2">
            <BarChart3 size={18} className="text-signal" /> Аналитика {isHr ? "по компании" : "команды"}
          </button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <Card title={<span className="flex items-center gap-3">{isHr ? "Ждут оформления" : "Ждут вашего решения"}
          {!!queue?.length && <span className="rounded-full bg-signal px-2.5 py-0.5 font-body text-xs font-bold text-forest">{queue.length}</span>}</span>}>
          {queue === null ? <Empty>Загрузка…</Empty> : queue.length === 0 ? (
            <Empty>{isHr ? "Очередь пуста — всё оформлено." : "Новых заявок нет. Когда сотрудник подаст заявку, она появится здесь."}</Empty>
          ) : (
            <div className="divide-y divide-line">{queue.map((r) => <RequestRow key={r.id} r={r} showEmployee />)}</div>
          )}
        </Card>

        <Card title="Недавние решения">
          {history.length === 0 ? <Empty>Пока пусто</Empty> : (
            <ul className="space-y-3">
              {history.map((r) => (
                <li key={r.id} className="text-sm">
                  <Link to={`/requests/${r.id}`} className="block rounded-2xl px-3 py-2 hover:bg-paper">
                    <span className="font-medium">{r.employee.full_name.split(" ").slice(0, 2).join(" ")}</span>
                    <span className="block text-xs text-muted">{r.type === "vacation" ? "Отпуск" : "Аванс"} №{r.id} · {fmtDate(r.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <div className="mb-4 mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{isHr ? "Все сотрудники" : "Подчинённые"}</h2>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск"
              className="w-full rounded-full border border-transparent bg-white py-2.5 pl-10 pr-4 text-[15px] outline-none focus:border-forest" />
          </div>
        </div>
        {people === null ? <Card><Empty>Загрузка…</Empty></Card> : visible.length === 0 ? <Card><Empty>Никого не найдено</Empty></Card> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <div key={p.id} className="flex flex-col rounded-[24px] bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest font-display text-sm font-bold text-signal">
                    {p.full_name.split(" ").slice(0, 2).map((x) => x[0]).join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.full_name.split(" ").slice(0, 2).join(" ")}</p>
                    <p className="truncate text-xs text-muted">{p.position}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-dashed border-line pt-4 text-[13px]">
                  <div><dt className="text-muted">Отдел</dt><dd className="font-medium">{p.department}</dd></div>
                  <div><dt className="text-muted">Отпуск</dt><dd className="font-medium">{p.vacation_balance_days} {pluralRu(p.vacation_balance_days, ["день", "дня", "дней"])}</dd></div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="dark" onClick={() => agent(`/сотрудник ${p.full_name.split(" ").slice(0, 2).join(" ")}`)}>
                    <UserSearch size={16} /> Досье
                  </Button>
                  <Button variant="light" onClick={() => setAssignTo(p)}>
                    <GraduationCap size={16} /> Курс
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AssignCourse employee={assignTo} onClose={() => setAssignTo(null)} />
    </div>
  );
}

function AssignCourse({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [due, setDue] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!employee) return;
    setDone(false);
    setError(null);
    setCourseId(null);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDue(d.toISOString().slice(0, 10));
    api.catalog().then(setCourses);
  }, [employee]);

  const submit = async () => {
    if (!employee || !courseId) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignCourse(employee.id, courseId, due || undefined);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!employee} onClose={onClose} title={done ? "Курс назначен" : "Назначить курс"}
      footer={done ? <Button variant="dark" onClick={onClose}>Готово</Button> : (
        <>
          <Button variant="light" onClick={onClose}>Отмена</Button>
          <Button variant="dark" disabled={!courseId || busy} onClick={submit}>Назначить</Button>
        </>
      )}>
      {employee && (done ? (
        <p className="text-[15px]">{employee.full_name} получил уведомление. Прогресс появится в его кабинете и в Jana Academy.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">Сотрудник: <b className="text-ink">{employee.full_name}</b></p>
          <div className="space-y-2">
            {courses.map((c) => (
              <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-[18px] border-2 p-4 transition ${
                courseId === c.id ? "border-forest bg-paper" : "border-line hover:border-forest/40"}`}>
                <input type="radio" name="course" className="mt-1 accent-[var(--color-forest)]" checked={courseId === c.id} onChange={() => setCourseId(c.id)} />
                <span>
                  <span className="block font-semibold">{c.title}</span>
                  <span className="block text-xs text-muted">{c.duration_min} мин · {c.description}</span>
                </span>
              </label>
            ))}
          </div>
          <Field label="Пройти до">
            <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <ErrorText>{error}</ErrorText>
        </div>
      ))}
    </Modal>
  );
}

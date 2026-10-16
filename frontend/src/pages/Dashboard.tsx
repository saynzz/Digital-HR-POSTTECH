import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, Bot, Palmtree } from "lucide-react";
import { api } from "../api/client";
import type { Enrollment, HRRequest, Notification } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Card, Empty, ProgressBar, StatusBadge, fmtDate } from "../components/ui";
import { useI18n } from "../i18n";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [courses, setCourses] = useState<Enrollment[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);

  useEffect(() => {
    api.requests("my").then(setRequests);
    api.myCourses().then(setCourses);
    api.notifications().then(setNotes);
  }, []);

  if (!user) return null;
  const e = user.employee;

  const quick = [
    { to: "/requests/new?type=vacation", label: t("home.new_vacation"), icon: Palmtree },
    { to: "/requests/new?type=advance", label: t("home.new_advance"), icon: Banknote },
    { to: "/assistant", label: t("home.ask"), icon: Bot },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Здравствуйте, {e.full_name.split(" ")[1]}!</h1>
        <p className="text-sm text-gray-500">{t(`role.${user.role}`)} · {e.company}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={e.full_name} className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Field label={t("profile.position")} value={e.position} />
            <Field label={t("profile.department")} value={e.department} />
            <Field label={t("profile.manager")} value={e.manager?.full_name ?? "—"} />
            <Field label={t("profile.hire_date")} value={fmtDate(e.hire_date)} />
          </dl>
          <p className="mt-4 text-xs text-gray-400">{t("profile.readonly")}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-500">{t("profile.vacation_balance")}</p>
          <p className="mt-1 text-4xl font-bold text-brand-600">
            {e.vacation_balance_days} <span className="text-lg font-medium text-gray-400">{t("profile.days")}</span>
          </p>
          <Link to="/requests/new?type=vacation" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
            {t("home.new_vacation")} →
          </Link>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {quick.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 font-medium transition hover:border-brand-500 hover:shadow-sm">
            <span className="rounded-xl bg-brand-50 p-2 text-brand-600"><Icon size={20} /></span>
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t("home.my_requests")} action={<Link to="/requests" className="text-sm text-brand-600">{t("common.all")}</Link>}>
          {requests.length === 0 ? <Empty /> : (
            <ul className="divide-y divide-gray-100">
              {requests.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <Link to={`/requests/${r.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-brand-700">
                    <span>{t(`type.${r.type}`)} · №{r.id}</span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("home.my_courses")} action={<Link to="/academy" className="text-sm text-brand-600">{t("common.all")}</Link>}>
          {courses.length === 0 ? <Empty /> : (
            <ul className="space-y-4">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link to={`/academy/${c.course.id}`} className="mb-1.5 block text-sm font-medium hover:text-brand-700">{c.course.title}</Link>
                  <ProgressBar value={c.progress} status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("home.notifications")} action={<Link to="/notifications" className="text-sm text-brand-600">{t("common.all")}</Link>}>
          {notes.length === 0 ? <Empty /> : (
            <ul className="space-y-3">
              {notes.slice(0, 4).map((n) => (
                <li key={n.id} className="flex gap-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-gray-200" : "bg-brand-500"}`} />
                  <Link to={n.link ?? "/notifications"} className="hover:text-brand-700">
                    <p className="font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500">{n.body}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

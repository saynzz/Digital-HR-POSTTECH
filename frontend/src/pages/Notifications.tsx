import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ClipboardList, GraduationCap, MessageCircleQuestion, PartyPopper } from "lucide-react";
import { api } from "../api/client";
import type { Notification } from "../api/types";
import { Card, Empty, PageHeader } from "../components/ui";

const ICONS: Record<string, typeof Bell> = {
  request_status: ClipboardList,
  course_assigned: GraduationCap,
  course_completed: PartyPopper,
  hr_question: MessageCircleQuestion,
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === y.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    api.notifications().then(setItems);
  }, []);

  const open = async (n: Notification) => {
    if (!n.is_read) {
      api.markRead(n.id).catch(() => {});
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null);
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    await api.markAllRead();
    setItems((list) => list?.map((x) => ({ ...x, is_read: true })) ?? null);
  };

  const unread = items?.filter((n) => !n.is_read).length ?? 0;
  const visible = (items ?? []).filter((n) => filter === "all" || !n.is_read);
  const groups: { label: string; list: Notification[] }[] = [];
  visible.forEach((n) => {
    const label = dayLabel(n.created_at);
    const g = groups.find((x) => x.label === label);
    if (g) g.list.push(n);
    else groups.push({ label, list: [n] });
  });

  return (
    <div>
      <PageHeader
        title="Уведомления"
        subtitle="Статусы заявок, назначенные курсы и ответы HR — в одной ленте."
        action={unread > 0 ? (
          <button onClick={readAll} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold hover:bg-white/70">
            <CheckCheck size={18} /> Прочитать все
          </button>
        ) : undefined}
      />

      <div className="mb-4 flex gap-1">
        {([["all", "Все", items?.length ?? 0], ["unread", "Непрочитанные", unread]] as const).map(([id, label, n]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === id ? "bg-forest text-white" : "text-muted hover:bg-white hover:text-ink"}`}>
            {label}<span className={`text-xs ${filter === id ? "text-white/60" : "text-gray-400"}`}>{n}</span>
          </button>
        ))}
      </div>

      {items === null ? <Card><Empty>Загрузка…</Empty></Card> : groups.length === 0 ? (
        <Card><Empty>{filter === "unread" ? "Всё прочитано" : "Уведомлений пока нет"}</Empty></Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</h2>
              <Card className="!p-2">
                <ul>
                  {g.list.map((n) => {
                    const Icon = ICONS[n.type] ?? Bell;
                    return (
                      <li key={n.id}>
                        <button onClick={() => open(n)}
                          className="flex w-full items-start gap-4 rounded-[18px] px-4 py-3.5 text-left transition hover:bg-paper/70">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                            n.is_read ? "bg-paper text-muted" : "bg-signal text-forest"}`}>
                            <Icon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[15px] leading-snug ${n.is_read ? "text-muted" : "font-semibold"}`}>{n.title}</span>
                            {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                          </span>
                          <span className="shrink-0 pt-0.5 text-xs text-muted">
                            {new Date(n.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-signal" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

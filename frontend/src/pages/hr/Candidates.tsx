import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "../../api/client";
import type { Candidate, CandidateStatus, Employee } from "../../api/types";
import { Button, Card, Empty, fmtDateTime } from "../../components/ui";
import CandidateCard from "./CandidateCard";
import CandidateForm from "./CandidateForm";
import { CANDIDATE_STATUS, CandidateBadge } from "./labels";

const FILTERS: (CandidateStatus | "all")[] = [
  "all", "interview_pending", "interview_passed", "interview_failed", "hired", "archived",
];

export default function Candidates() {
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<CandidateStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<Candidate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);

  useEffect(() => {
    api.candidates().then(setItems);
    api.team().then(setEmployees);
  }, []);

  const upsert = (c: Candidate) => {
    setItems((list) => {
      const prev = list ?? [];
      return prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
    });
    setOpened((o) => (o && o.id === c.id ? c : o));
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items?.filter((c) => c.status !== "archived").length ?? 0 };
    items?.forEach((c) => (m[c.status] = (m[c.status] ?? 0) + 1));
    return m;
  }, [items]);

  const visible = (items ?? [])
    .filter((c) => (filter === "all" ? c.status !== "archived" : c.status === filter))
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || [c.full_name, c.email, c.position, c.department].some((v) => v.toLowerCase().includes(q));
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по ФИО, email, должности"
            className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> Добавить кандидата</Button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              filter === f ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}>
            {f === "all" ? "Все" : CANDIDATE_STATUS[f].label}
            <span className={`ml-1.5 ${filter === f ? "text-white/80" : "text-gray-400"}`}>{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        {items === null ? <Empty>Загрузка…</Empty> : visible.length === 0 ? <Empty>Кандидатов нет</Empty> : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Кандидат</th>
                  <th className="px-3 py-3">Должность</th>
                  <th className="px-3 py-3">Собеседование</th>
                  <th className="px-5 py-3">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((c) => (
                  <tr key={c.id} onClick={() => setOpened(c)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{c.position}</p>
                      <p className="text-xs text-gray-500">{c.department}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{c.interview_at ? fmtDateTime(c.interview_at) : "—"}</td>
                    <td className="px-5 py-3"><CandidateBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-gray-100 md:hidden">
              {visible.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setOpened(c)} className="w-full px-4 py-3 text-left hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{c.full_name}</p>
                      <CandidateBadge status={c.status} />
                    </div>
                    <p className="text-sm text-gray-600">{c.position} · {c.department}</p>
                    {c.interview_at && <p className="text-xs text-gray-500">Собеседование: {fmtDateTime(c.interview_at)}</p>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <CandidateCard candidate={opened} onClose={() => setOpened(null)} onChanged={upsert}
        onEdit={(c) => { setEditing(c); setFormOpen(true); }} />
      <CandidateForm open={formOpen} candidate={editing} employees={employees} onClose={() => setFormOpen(false)}
        onSaved={(c) => { upsert(c); setFormOpen(false); if (!editing) setOpened(c); }} />
    </div>
  );
}

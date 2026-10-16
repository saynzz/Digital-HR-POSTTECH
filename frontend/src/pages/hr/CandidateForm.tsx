import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { Candidate, CandidateInput, Employee } from "../../api/types";
import { Button, ErrorText, Field, Modal, inputCls } from "../../components/ui";

const EMPTY: CandidateInput = {
  full_name: "", email: "", phone: null, position: "", department: "",
  manager_id: null, interview_at: null, planned_start_date: null, notes: null,
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CandidateForm({ open, candidate, employees, onClose, onSaved }: {
  open: boolean;
  candidate: Candidate | null;
  employees: Employee[];
  onClose: () => void;
  onSaved: (c: Candidate) => void;
}) {
  const [form, setForm] = useState<CandidateInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(candidate ? {
      full_name: candidate.full_name, email: candidate.email, phone: candidate.phone,
      position: candidate.position, department: candidate.department, manager_id: candidate.manager?.id ?? null,
      interview_at: candidate.interview_at, planned_start_date: candidate.planned_start_date, notes: candidate.notes,
    } : EMPTY);
  }, [open, candidate]);

  const set = <K extends keyof CandidateInput>(k: K, v: CandidateInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const departments = [...new Set(employees.map((e) => e.department))].sort();
  const managers = employees.filter((e) => !form.department || e.department === form.department);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { ...form, phone: form.phone || null, notes: form.notes || null };
    try {
      const saved = candidate ? await api.updateCandidate(candidate.id, payload) : await api.createCandidate(payload);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide title={candidate ? "Редактировать кандидата" : "Новый кандидат"}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button type="submit" form="candidate-form" disabled={busy}>{candidate ? "Сохранить" : "Добавить"}</Button>
      </>}>
      <form id="candidate-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="ФИО" required>
            <input className={inputCls} required minLength={3} value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)} placeholder="Фамилия Имя Отчество" />
          </Field>
        </div>
        <Field label="Email" required hint="На него придёт ссылка для создания пароля">
          <input className={inputCls} type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Телефон">
          <input className={inputCls} type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)}
            placeholder="+7 7__ ___ __ __" />
        </Field>
        <Field label="Должность" required>
          <input className={inputCls} required minLength={2} value={form.position} onChange={(e) => set("position", e.target.value)} />
        </Field>
        <Field label="Подразделение" required>
          <input className={inputCls} required minLength={2} list="departments" value={form.department}
            onChange={(e) => set("department", e.target.value)} />
          <datalist id="departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="Будущий руководитель">
          <select className={inputCls} value={form.manager_id ?? ""}
            onChange={(e) => set("manager_id", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Не выбран</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name} — {m.position}</option>)}
          </select>
        </Field>
        <Field label="Дата и время собеседования">
          <input className={inputCls} type="datetime-local" value={toLocalInput(form.interview_at)}
            onChange={(e) => set("interview_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </Field>
        <Field label="Планируемая дата выхода">
          <input className={inputCls} type="date" value={form.planned_start_date ?? ""}
            onChange={(e) => set("planned_start_date", e.target.value || null)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Заметки HR">
            <textarea className={`${inputCls} min-h-24`} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
              placeholder="Опыт, пожелания, договорённости" />
          </Field>
        </div>
        <div className="sm:col-span-2"><ErrorText>{error}</ErrorText></div>
      </form>
    </Modal>
  );
}

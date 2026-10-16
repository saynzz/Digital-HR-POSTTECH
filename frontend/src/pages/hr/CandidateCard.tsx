import { useEffect, useState, type ReactNode } from "react";
import { Archive, CheckCircle2, Pencil, RotateCcw, UserPlus, XCircle } from "lucide-react";
import { api } from "../../api/client";
import type { Candidate, HireResult } from "../../api/types";
import { Button, ErrorText, Field, Modal, fmtDate, fmtDateTime, inputCls } from "../../components/ui";
import InviteLinkBox from "./InviteLinkBox";
import { CandidateBadge } from "./labels";

type Step = "view" | "hire" | "hired";

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

export default function CandidateCard({ candidate, onClose, onChanged, onEdit }: {
  candidate: Candidate | null;
  onClose: () => void;
  onChanged: (c: Candidate) => void;
  onEdit: (c: Candidate) => void;
}) {
  const [step, setStep] = useState<Step>("view");
  const [comment, setComment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [role, setRole] = useState<"employee" | "manager">("employee");
  const [hired, setHired] = useState<HireResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStep("view");
    setComment("");
    setError(null);
    setHired(null);
    setRole("employee");
    setStartDate(candidate?.planned_start_date ?? tomorrow());
  }, [candidate?.id]);

  if (!candidate) return null;
  const c = candidate;

  const run = async (fn: () => Promise<Candidate>) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await fn());
      setComment("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doHire = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.hireCandidate(c.id, startDate, role);
      setHired(res);
      setStep("hired");
      onChanged(res.candidate);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const editable = c.status !== "hired" && c.status !== "archived";
  const canDecide = editable;

  let footer: ReactNode = null;
  if (step === "view") {
    footer = (
      <>
        {c.status === "archived" && (
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.restoreCandidate(c.id))}>
            <RotateCcw size={16} /> Вернуть в работу
          </Button>
        )}
        {editable && (
          <Button variant="secondary" disabled={busy} onClick={() => run(() => api.archiveCandidate(c.id, comment))}>
            <Archive size={16} /> Открепить
          </Button>
        )}
        {c.status === "interview_passed" && (
          <Button disabled={busy} onClick={() => { setError(null); setStep("hire"); }}>
            <UserPlus size={16} /> Трудоустроить
          </Button>
        )}
      </>
    );
  } else if (step === "hire") {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setStep("view")}>Назад</Button>
        <Button disabled={busy || !startDate} onClick={doHire}><UserPlus size={16} /> Трудоустроить и отправить ссылку</Button>
      </>
    );
  } else {
    footer = <Button onClick={onClose}>Готово</Button>;
  }

  return (
    <Modal open onClose={onClose} wide footer={footer} title={
      <span className="flex flex-wrap items-center gap-2">{c.full_name} <CandidateBadge status={c.status} /></span>
    }>
      {step === "view" && (
        <div className="space-y-5">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Info label="Должность" value={c.position} />
            <Info label="Подразделение" value={c.department} />
            <Info label="Email" value={c.email} />
            <Info label="Телефон" value={c.phone ?? "—"} />
            <Info label="Будущий руководитель" value={c.manager?.full_name ?? "—"} />
            <Info label="Собеседование" value={c.interview_at ? fmtDateTime(c.interview_at) : "Не назначено"} />
            <Info label="Планируемый выход" value={c.planned_start_date ? fmtDate(c.planned_start_date) : "—"} />
            <Info label="Добавлен" value={fmtDate(c.created_at)} />
          </dl>
          {c.notes && (
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Заметки HR</p>
              <p className="mt-1 whitespace-pre-line text-sm">{c.notes}</p>
            </div>
          )}
          {c.status_comment && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-500">Комментарий к статусу: </span>{c.status_comment}
            </div>
          )}

          {canDecide && (
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="mb-3 text-sm font-semibold">Результат собеседования</p>
              <div className="flex flex-wrap gap-2">
                {c.status !== "interview_passed" && (
                  <Button variant="secondary" disabled={busy}
                    onClick={() => run(() => api.setCandidateStatus(c.id, "interview_passed", comment))}>
                    <CheckCircle2 size={16} className="text-brand-600" /> Прошёл
                  </Button>
                )}
                {c.status !== "interview_failed" && (
                  <Button variant="secondary" disabled={busy}
                    onClick={() => run(() => api.setCandidateStatus(c.id, "interview_failed", comment))}>
                    <XCircle size={16} className="text-red-600" /> Не прошёл
                  </Button>
                )}
                {c.status !== "interview_pending" && (
                  <Button variant="secondary" disabled={busy}
                    onClick={() => run(() => api.setCandidateStatus(c.id, "interview_pending", comment))}>
                    <RotateCcw size={16} /> Вернуть в ожидание
                  </Button>
                )}
                <Button variant="secondary" disabled={busy} onClick={() => onEdit(c)}>
                  <Pencil size={16} /> Редактировать
                </Button>
              </div>
              <input className={`${inputCls} mt-3`} placeholder="Комментарий (необязательно)" value={comment}
                onChange={(e) => setComment(e.target.value)} />
            </div>
          )}

          {c.status === "hired" && (
            <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Сотрудник оформлен. Управлять доступом можно во вкладке «Доступы».
            </p>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {step === "hire" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Будет создана запись сотрудника в 1С:ЗУП и учётная запись в JanaMen. На <b>{c.email}</b> уйдёт
            одноразовая ссылка, по которой сотрудник сам придумает пароль.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Дата выхода" required>
              <input className={inputCls} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Роль в платформе" hint="Роль HR выдаётся отдельно">
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as "employee" | "manager")}>
                <option value="employee">Сотрудник</option>
                <option value="manager">Руководитель</option>
              </select>
            </Field>
          </div>
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {step === "hired" && hired && (
        <div className="space-y-4">
          <p className="text-sm">
            <b>{c.full_name}</b> трудоустроен(а). Назначен вводный курс, руководитель получил уведомление.
          </p>
          <InviteLinkBox invite={hired} />
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

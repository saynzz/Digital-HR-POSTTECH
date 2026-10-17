import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Database, Download, FileSpreadsheet, History, Mail, MailX, RefreshCw,
  Upload, UserMinus, UserPlus, UserRoundCheck, UserRoundPen,
} from "lucide-react";
import { api } from "../../api/client";
import type { ImportAction, ImportItem, ImportRun, ZupStatus } from "../../api/types";
import { Button, Card, Empty, fmtDate, fmtDateTime } from "../../components/ui";

const ACTION: Record<ImportAction, { label: string; cls: string; icon: typeof UserPlus }> = {
  create: { label: "Новый", cls: "bg-brand-50 text-brand-700", icon: UserPlus },
  update: { label: "Изменения", cls: "bg-signal-50 text-signal-ink", icon: UserRoundPen },
  dismiss: { label: "Увольнение", cls: "bg-danger-50 text-danger", icon: UserMinus },
  skip: { label: "Без изменений", cls: "bg-gray-100 text-muted", icon: UserRoundCheck },
  error: { label: "Ошибка", cls: "bg-danger-50 text-danger", icon: AlertTriangle },
};
const FILTERS: (ImportAction | "all")[] = ["all", "create", "update", "dismiss", "error", "skip"];

export default function ImportEmployees() {
  const [zup, setZup] = useState<ZupStatus | null>(null);
  const [run, setRun] = useState<ImportRun | null>(null);
  const [history, setHistory] = useState<ImportRun[]>([]);
  const [fullSync, setFullSync] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [filter, setFilter] = useState<ImportAction | "all">("all");
  const [opts, setOpts] = useState({ send_invites: true, assign_onboarding: true, block_missing: false });
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = () => api.importRuns().then(setHistory);
  useEffect(() => {
    api.zupStatus().then(setZup);
    loadHistory();
  }, []);

  const go = async (key: string, fn: () => Promise<ImportRun>) => {
    setBusy(key);
    setError(null);
    try {
      const r = await fn();
      setRun(r);
      setFilter(r.summary.error ? "error" : r.summary.create ? "create" : "all");
      loadHistory();
      setTimeout(() => document.getElementById("import-preview")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onFile = (f: File | undefined) => f && go("file", () => api.importPreview(f, fullSync));
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    onFile(e.dataTransfer.files[0]);
  };

  const s = run?.summary;
  const items = (run?.items ?? []).filter((i) => filter === "all" || i.action === filter);
  const actionable = s ? s.create + s.update + s.dismiss + (opts.block_missing ? s.missing : 0) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
          className={`flex flex-col rounded-[28px] border-2 border-dashed p-6 transition ${drag ? "border-forest bg-brand-50" : "border-line bg-white"}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest text-signal"><FileSpreadsheet size={24} /></span>
            <div>
              <p className="font-display text-[18px] font-bold">Файл Excel или CSV</p>
              <p className="mt-1 text-[13px] text-muted">Выгрузка из 1С:ЗУП, другой HR-системы или таблица HR. Колонки узнаются по названию: «Табельный номер», «ФИО», «Должность», «Подразделение», «Дата приёма», «Email», «Табельный номер руководителя», «Остаток отпуска».</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={!!busy}
            className="mt-5 flex flex-1 flex-col items-center justify-center gap-2 rounded-[22px] bg-paper px-4 py-8 text-center transition hover:bg-line/60 disabled:opacity-60">
            <Upload size={26} className="text-forest" />
            <span className="font-semibold">{busy === "file" ? "Проверяем файл…" : "Перетащите файл сюда или выберите"}</span>
            <span className="text-[12px] text-muted">.xlsx или .csv, до 5 МБ. Сначала покажем, что изменится</span>
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="accent-[var(--color-forest)]" checked={fullSync} onChange={(e) => setFullSync(e.target.checked)} />
              Полная сверка: показать тех, кого нет в файле
            </label>
            <button onClick={() => api.download("/hr/import/template.csv", "janahub-employees-template.csv")}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-forest hover:underline"><Download size={15} /> Шаблон</button>
          </div>
        </div>

        <div className="flex flex-col rounded-[28px] bg-forest p-6 text-white">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-signal text-forest"><Database size={24} /></span>
            <div>
              <p className="font-display text-[18px] font-bold">Синхронизация с 1С:ЗУП</p>
              <p className="mt-1 text-[13px] text-white/65">Jana Hub читает сотрудников напрямую из 1С через HTTP-сервис или OData: новые сотрудники, переводы, руководители, остатки отпусков и увольнения.</p>
            </div>
          </div>
          <div className="mt-5 flex-1 rounded-[22px] bg-white/[0.07] p-4 text-[13px]">
            {zup === null ? "Проверяем подключение…" : zup.mode === "demo" ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-signal"><AlertTriangle size={15} /> Демо-режим</p>
                <p className="mt-1.5 text-white/70">Адрес 1С не задан, поэтому покажем демонстрационную выгрузку: 4 новых сотрудника, перевод и изменение остатка отпуска. Для боевого подключения укажите <code className="rounded bg-white/10 px-1">ZUP_URL</code>, <code className="rounded bg-white/10 px-1">ZUP_USER</code> и <code className="rounded bg-white/10 px-1">ZUP_PASSWORD</code> в .env (см. docs/IMPLEMENTATION.md).</p>
              </>
            ) : zup.ok ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-signal"><CheckCircle2 size={15} /> Подключено</p>
                <p className="mt-1.5 break-all text-white/70">{zup.url} · сотрудников в 1С: {zup.count}</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-[#ffb4a6]"><AlertTriangle size={15} /> 1С недоступна</p>
                <p className="mt-1.5 break-all text-white/70">{zup.url} · {zup.error}</p>
              </>
            )}
          </div>
          <button onClick={() => go("zup", () => api.zupPreview(fullSync))} disabled={!!busy || (zup?.mode === "live" && !zup.ok)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-signal py-3 text-[15px] font-semibold text-forest transition hover:brightness-105 disabled:opacity-50">
            <RefreshCw size={17} className={busy === "zup" ? "animate-spin" : ""} /> {busy === "zup" ? "Получаем данные…" : "Получить данные из 1С"}
          </button>
        </div>
      </div>

      {error && <p className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">{error}</p>}

      {run && s && (
        <div id="import-preview" className="space-y-4">
          <Card title={<span>{run.applied ? "Импорт применён" : "Что изменится"} <span className="font-body text-sm font-normal text-muted">· {run.source_label}{run.filename ? `: ${run.filename}` : ""}</span></span>}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {([["create", "Новые", s.create], ["update", "Изменения", s.update], ["dismiss", "Увольнения", s.dismiss],
                ["error", "Ошибки", s.error], ["skip", "Без изменений", s.skip]] as const).map(([k, l, n]) => (
                <button key={k} onClick={() => setFilter(filter === k ? "all" : k)}
                  className={`rounded-[18px] px-4 py-3 text-left transition ${filter === k ? "ring-2 ring-forest" : ""} ${n && k !== "skip" ? ACTION[k].cls : "bg-paper"}`}>
                  <p className="font-display text-[24px] font-bold leading-none">{n}</p>
                  <p className="mt-1 text-[12px] font-medium">{l}</p>
                </button>
              ))}
              <div className="rounded-[18px] bg-paper px-4 py-3">
                <p className="font-display text-[24px] font-bold leading-none">{s.invites}</p>
                <p className="mt-1 text-[12px] font-medium">Получат приглашение{s.no_email ? ` · без email: ${s.no_email}` : ""}</p>
              </div>
            </div>

            {run.result ? <ResultBlock run={run} /> : (
              <>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${filter === f ? "bg-forest text-white" : "bg-paper text-muted hover:text-ink"}`}>
                      {f === "all" ? `Все · ${s.total}` : ACTION[f].label}
                    </button>
                  ))}
                </div>
                <div className="-mx-1 mt-3 overflow-x-auto px-1">
                  <table className="w-full min-w-[760px] text-[13px]">
                    <thead>
                      <tr className="text-left text-[11.5px] text-muted">
                        <th className="pb-2 pr-4 font-medium">Строка</th><th className="pb-2 pr-4 font-medium">Действие</th>
                        <th className="pb-2 pr-4 font-medium">Сотрудник</th><th className="pb-2 pr-4 font-medium">Должность · подразделение</th>
                        <th className="pb-2 pr-4 font-medium">Доступ</th><th className="pb-2 pr-4 font-medium">Подробности</th>
                      </tr>
                    </thead>
                    <tbody>{items.slice(0, 200).map((i) => <Row key={`${i.row}-${i.external_id}`} i={i} />)}</tbody>
                  </table>
                  {items.length === 0 && <Empty>Нет строк с таким статусом</Empty>}
                </div>
                {run.missing.length > 0 && (
                  <div className="mt-4 rounded-[18px] bg-signal-50 p-4 text-[13px] text-signal-ink">
                    <p className="font-semibold">Нет в источнике: {run.missing.length}</p>
                    <p className="mt-1">{run.missing.slice(0, 12).map((m) => `${m.full_name} (${m.external_id})`).join(", ")}{run.missing.length > 12 ? "…" : ""}</p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-line pt-4">
                  <div className="space-y-1.5 text-[13px]">
                    <Check label="Отправить новым сотрудникам ссылку на почту для создания пароля" v={opts.send_invites} on={(v) => setOpts({ ...opts, send_invites: v })} />
                    <Check label="Назначить новичкам траекторию «Адаптация новичка»" v={opts.assign_onboarding} on={(v) => setOpts({ ...opts, assign_onboarding: v })} />
                    {s.missing > 0 && <Check label={`Заблокировать доступ тем, кого нет в источнике (${s.missing})`} v={opts.block_missing} on={(v) => setOpts({ ...opts, block_missing: v })} />}
                  </div>
                  <Button variant="dark" disabled={!!busy || actionable === 0} onClick={() => go("apply", () => api.applyImport(run.id, opts))}>
                    {busy === "apply" ? "Применяем…" : actionable === 0 ? "Нечего применять" : <>Применить <ArrowRight size={16} /></>}
                  </Button>
                </div>
                {s.error > 0 && <p className="mt-2 text-[12px] text-muted">Строки с ошибками будут пропущены: исправьте их в файле и загрузите снова.</p>}
              </>
            )}
          </Card>
        </div>
      )}

      {history.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><History size={18} /> История загрузок</span>}>
          <ul className="divide-y divide-line text-[13px]">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <b>{h.source_label}{h.filename ? `: ${h.filename}` : ""}</b>
                  <span className="block text-[12px] text-muted">{fmtDateTime(h.created_at)}{h.created_by ? ` · ${h.created_by}` : ""}</span>
                </span>
                <span className="text-muted">+{h.summary.create} · ~{h.summary.update} · −{h.summary.dismiss}{h.summary.error ? ` · ошибок ${h.summary.error}` : ""}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${h.applied ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-muted"}`}>
                  {h.applied ? "применён" : "предпросмотр"}
                </span>
                <button onClick={() => go(`h${h.id}`, () => api.importRun(h.id))} className="font-semibold text-forest hover:underline">Открыть</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Check({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" className="accent-[var(--color-forest)]" checked={v} onChange={(e) => on(e.target.checked)} /> {label}
    </label>
  );
}

function Row({ i }: { i: ImportItem }) {
  const A = ACTION[i.action];
  return (
    <tr className="border-t border-dashed border-line align-top">
      <td className="py-2.5 pr-4 text-muted">{i.row}</td>
      <td className="py-2.5 pr-4"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${A.cls}`}><A.icon size={13} /> {A.label}</span></td>
      <td className="py-2.5 pr-4">
        <b className="block">{i.full_name || "—"}</b>
        <span className="text-[12px] text-muted">{i.external_id || "без номера"}{i.role === "manager" ? " · руководитель" : i.role === "hr" ? " · HR" : ""}</span>
      </td>
      <td className="py-2.5 pr-4">
        {i.position || "—"}<span className="block text-[12px] text-muted">{i.department}{i.hire_date ? ` · с ${fmtDate(i.hire_date)}` : ""}</span>
      </td>
      <td className="py-2.5 pr-4">
        {i.account === "invite" ? <span className="inline-flex items-center gap-1 text-brand-700"><Mail size={13} /> {i.email}</span>
          : i.account === "no_email" ? <span className="inline-flex items-center gap-1 text-signal-ink"><MailX size={13} /> нет email</span>
          : i.account === "exists" ? <span className="text-muted">есть</span> : <span className="text-muted">—</span>}
      </td>
      <td className="py-2.5 pr-4">
        {i.errors.length > 0 ? (
          <ul className="space-y-0.5 text-danger">{i.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        ) : i.changes.length > 0 ? (
          <ul className="space-y-0.5">{i.changes.map((c) => (
            <li key={c.field}><span className="text-muted">{c.field}:</span> <s className="text-muted">{String(c.from)}</s> → <b>{String(c.to)}</b></li>
          ))}</ul>
        ) : i.action === "dismiss" ? <span className="text-danger">Уволен {i.dismissal_date ? fmtDate(i.dismissal_date) : ""} — доступ будет заблокирован</span>
          : i.action === "create" ? <span className="text-muted">{i.manager_external_id ? `Руководитель: ${i.manager_external_id}` : "Без руководителя"}</span>
          : <span className="text-muted">—</span>}
      </td>
    </tr>
  );
}

function ResultBlock({ run }: { run: ImportRun }) {
  const r = run.result!;
  return (
    <div className="mt-5 space-y-3 rounded-[22px] bg-brand-50 p-5 text-[13.5px]">
      <p className="flex items-center gap-2 font-display text-[17px] font-bold text-brand-700"><CheckCircle2 size={20} /> Готово{run.applied_at ? ` · ${fmtDateTime(run.applied_at)}` : ""}</p>
      <p>Создано: <b>{r.created.length}</b> · обновлено: <b>{r.updated.length}</b> · уволено: <b>{r.dismissed.length}</b>{r.blocked_missing.length ? <> · заблокировано отсутствующих: <b>{r.blocked_missing.length}</b></> : null}</p>
      {r.invited.length > 0 && (
        <div>
          <p className="font-semibold">Приглашения ({r.invited.length})</p>
          <ul className="mt-1 space-y-0.5">{r.invited.map((i) => (
            <li key={i.email}>{i.name} — {i.email} · {i.email_sent ? "письмо отправлено" : "письмо не отправлено (ссылку можно выдать во вкладке «Доступы»)"}</li>
          ))}</ul>
        </div>
      )}
      {r.mail_errors.length > 0 && <p className="text-danger">Почта: {r.mail_errors.join("; ")}</p>}
    </div>
  );
}

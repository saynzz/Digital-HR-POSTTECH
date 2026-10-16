import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Banknote, Check, FileText, Palmtree, Truck, Undo2, X } from "lucide-react";
import { api } from "../api/client";
import type { HRRequestDetail, RequestEvent } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import RouteTrack from "../components/RouteTrack";
import { Button, Card, Empty, ErrorText, StatusBadge, fmtDate, fmtDateTime, fmtMoney, inputCls, pluralRu } from "../components/ui";
import { useI18n } from "../i18n";

function eventTitle(ev: RequestEvent, i: number) {
  if (i === 0) return "Заявка подана";
  return {
    pending_manager: "Возвращена руководителю",
    pending_hr: "Согласовано руководителем",
    approved: "Оформлено HR",
    rejected: "Отклонено",
    cancelled: "Отозвано сотрудником",
  }[ev.to_status];
}

export default function RequestDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const [req, setReq] = useState<HRRequestDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const justSent = params.get("sent") === "1";

  useEffect(() => {
    setReq(null);
    api.request(Number(id)).then(setReq).catch((e) => setLoadError((e as Error).message));
  }, [id]);

  if (loadError) {
    return (
      <Card className="mt-6">
        <Empty action={<Link to="/requests" className="text-sm font-semibold text-forest hover:underline">К списку заявок</Link>}>
          {loadError}
        </Empty>
      </Card>
    );
  }
  if (!req || !user) return <Card className="mt-6"><Empty>{t("common.loading")}</Empty></Card>;

  const own = req.employee.id === user.employee.id;
  const Icon = req.type === "vacation" ? Palmtree : Banknote;
  const p = req.payload;

  const act = async (fn: () => Promise<HRRequestDetail>) => {
    setBusy(true);
    setError(null);
    try {
      setReq(await fn());
      setComment("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stageHr = req.status === "pending_hr";

  return (
    <div className="space-y-6 pt-4">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={16} /> Назад
      </button>

      {justSent && (
        <div className="rise-in flex items-center gap-4 rounded-[24px] bg-signal px-6 py-4 text-forest">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-signal"><Truck size={20} /></span>
          <div className="flex-1">
            <p className="font-display text-[16px] font-semibold">Заявка в пути</p>
            <p className="text-sm">{req.status === "pending_manager" ? "Руководитель получил уведомление и примет решение." : "Заявка передана в HR на оформление."}</p>
          </div>
          <button onClick={() => setParams({})} className="rounded-full p-2 hover:bg-forest/10" aria-label="Скрыть"><X size={18} /></button>
        </div>
      )}

      <section className="rounded-[32px] bg-forest px-6 py-8 text-white sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-signal text-forest"><Icon size={24} /></span>
            <div>
              <p className="text-sm text-white/60">Заявка №{req.id} · {fmtDate(req.created_at)}</p>
              <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[38px]">{t(`type.${req.type}`)}</h1>
            </div>
          </div>
          <span className="rounded-full bg-white px-1 py-1"><StatusBadge status={req.status} /></span>
        </div>
        <div className="mt-8 rounded-[20px] bg-white px-5 pb-3 pt-5 text-ink">
          <RouteTrack status={req.status} />
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Детали">
            <dl className="grid gap-x-6 gap-y-4 text-[15px] sm:grid-cols-2">
              {!own && <Info label="Сотрудник" value={`${req.employee.full_name}, ${req.employee.position}`} wide />}
              {req.type === "vacation" ? (
                <>
                  <Info label="Даты" value={`${fmtDate(p.start_date!)} – ${fmtDate(p.end_date!)}`} />
                  <Info label="Продолжительность" value={`${p.days} ${pluralRu(p.days ?? 0, ["день", "дня", "дней"])}`} />
                </>
              ) : (
                <Info label="Сумма" value={fmtMoney(p.amount ?? 0)} />
              )}
              {p.comment && <Info label="Комментарий" value={p.comment} wide />}
              {req.external_doc_id && (
                <div className="sm:col-span-2 flex items-center gap-3 rounded-[18px] bg-paper px-4 py-3">
                  <FileText size={18} className="text-forest" />
                  <span className="text-sm">Документ в Documentolog: <b>{req.external_doc_id}</b></span>
                </div>
              )}
            </dl>
          </Card>

          <Card title="История">
            <ol className="relative">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-line" aria-hidden />
              {req.events.map((ev, i) => (
                <li key={ev.id} className="relative flex gap-4 py-3">
                  <span className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white ${
                    ev.to_status === "rejected" ? "bg-danger" : ev.to_status === "approved" ? "bg-brand-600" : i === req.events.length - 1 ? "bg-signal" : "bg-forest"}`} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{eventTitle(ev, i)}</p>
                    <p className="text-xs text-muted">{fmtDateTime(ev.created_at)}{ev.actor_name ? ` · ${ev.actor_name}` : ""}</p>
                    {ev.comment && i > 0 && <p className="mt-1.5 rounded-2xl bg-paper px-3 py-2 text-sm">{ev.comment}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24">
          {req.can_decide && (
            <Card title={stageHr ? "Оформление" : "Ваше решение"}>
              <p className="mb-3 text-sm text-muted">
                {stageHr
                  ? "После оформления заявка будет проведена в 1С:ЗУП и зарегистрирована в Documentolog."
                  : "После согласования заявка уйдёт в HR на оформление."}
              </p>
              <textarea className={`${inputCls} min-h-20`} placeholder="Комментарий (необязательно)" value={comment}
                onChange={(e) => setComment(e.target.value)} maxLength={500} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="light" disabled={busy} onClick={() => act(() => api.decide(req.id, "reject", comment))}>
                  <X size={16} className="text-danger" /> Отклонить
                </Button>
                <Button variant="dark" disabled={busy} onClick={() => act(() => api.decide(req.id, "approve", comment))}>
                  <Check size={16} /> {stageHr ? "Оформить" : "Согласовать"}
                </Button>
              </div>
            </Card>
          )}

          {req.can_cancel && (
            <Card>
              <p className="mb-3 text-sm text-muted">Передумали? Заявку можно отозвать, пока её не оформил HR.</p>
              <Button variant="light" className="w-full" disabled={busy} onClick={() => act(() => api.cancelRequest(req.id))}>
                <Undo2 size={16} /> Отозвать заявку
              </Button>
            </Card>
          )}

          {!req.can_decide && !req.can_cancel && (
            <Card>
              <p className="text-sm text-muted">
                {req.status === "approved" ? "Заявка оформлена. Приказ проведён в 1С:ЗУП." :
                  req.status === "rejected" ? "Заявка отклонена. Комментарий — в истории." :
                  req.status === "cancelled" ? "Заявка отозвана." :
                  req.status === "pending_manager" ? "Ждём решения руководителя." : "Заявка на оформлении в HR."}
              </p>
            </Card>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

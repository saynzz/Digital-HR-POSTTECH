import { Link } from "react-router-dom";
import { Banknote, Palmtree } from "lucide-react";
import type { HRRequest } from "../api/types";
import { useI18n } from "../i18n";
import RouteTrack from "./RouteTrack";
import { fmtDate, fmtMoney, fmtShortDate } from "./ui";

export default function RequestRow({ r, showEmployee = false }: { r: HRRequest; showEmployee?: boolean }) {
  const { t } = useI18n();
  const Icon = r.type === "vacation" ? Palmtree : Banknote;
  const details = r.type === "vacation"
    ? `${fmtShortDate(r.payload.start_date!)} – ${fmtShortDate(r.payload.end_date!)}, ${r.payload.days} ${t("common.days_short")}`
    : fmtMoney(r.payload.amount!);

  return (
    <Link to={`/requests/${r.id}`}
      className="-mx-3 grid gap-x-6 gap-y-4 rounded-2xl px-3 py-5 transition-colors hover:bg-paper/60 md:grid-cols-[minmax(0,1fr)_300px] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          r.type === "vacation" ? "bg-brand-50 text-brand-700" : "bg-signal-50 text-signal-ink"}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">
            {t(`type.${r.type}`)}<span className="font-normal text-muted">, {details}</span>
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {showEmployee && <>{r.employee.full_name}, </>}№{r.id}, {t("requests.created").toLowerCase()} {fmtDate(r.created_at)}
          </p>
        </div>
      </div>
      <div className="pl-[56px] md:pl-0 md:pt-1">
        <RouteTrack status={r.status} />
      </div>
    </Link>
  );
}

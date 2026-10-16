import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../api/client";
import type { HRRequest } from "../api/types";
import RequestRow from "../components/RequestRow";
import { Card, Empty, PageHeader, buttonClass } from "../components/ui";
import { useI18n, type TKey } from "../i18n";

type Filter = "all" | "active" | "closed";
const FILTERS: { id: Filter; key: TKey }[] = [
  { id: "all", key: "requests.filter_all" },
  { id: "active", key: "requests.filter_active" },
  { id: "closed", key: "requests.filter_closed" },
];
const isActive = (r: HRRequest) => r.status === "pending_manager" || r.status === "pending_hr";

export default function Requests() {
  const { t } = useI18n();
  const [items, setItems] = useState<HRRequest[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api.requests("my").then(setItems);
  }, []);

  const count = (f: Filter) =>
    !items ? 0 : f === "all" ? items.length : items.filter((r) => (f === "active" ? isActive(r) : !isActive(r))).length;
  const visible = (items ?? []).filter((r) =>
    filter === "all" ? true : filter === "active" ? isActive(r) : !isActive(r));

  return (
    <div>
      <PageHeader
        title={t("nav.requests")}
        subtitle={t("requests.subtitle")}
        action={<Link to="/requests/new" className={buttonClass("primary")}><Plus size={17} /> {t("requests.new")}</Link>}
      />

      {items && items.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
          <Stat value={count("active")} label={t("requests.filter_active")} tone="bg-signal text-forest" />
          <Stat value={items.filter((r) => r.status === "approved").length} label={t("status.approved")} tone="bg-forest text-white" />
          <Stat value={items.filter((r) => r.status === "rejected" || r.status === "cancelled").length} label={t("requests.stopped")} tone="bg-white text-ink" />
        </div>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === f.id ? "bg-forest text-white" : "text-muted hover:bg-white hover:text-ink"}`}>
            {t(f.key)}
            <span className={`text-xs ${filter === f.id ? "text-white/60" : "text-gray-400"}`}>{count(f.id)}</span>
          </button>
        ))}
      </div>

      <Card className="py-3">
        {items === null ? <Empty>{t("common.loading")}</Empty> : items.length === 0 ? (
          <Empty action={<Link to="/requests/new" className={buttonClass("primary")}><Plus size={17} /> {t("requests.new")}</Link>}>
            {t("requests.empty")}
          </Empty>
        ) : visible.length === 0 ? <Empty>{t("requests.empty_filter")}</Empty> : (
          <div className="divide-y divide-line">
            {visible.map((r) => <RequestRow key={r.id} r={r} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={`rounded-[24px] px-4 py-4 sm:px-6 sm:py-5 ${tone}`}>
      <p className="font-display text-[34px] font-bold leading-none tracking-[-0.04em] sm:text-[44px]">{value}</p>
      <p className="mt-2 text-[13px] font-medium opacity-75 sm:text-[14px]">{label}</p>
    </div>
  );
}

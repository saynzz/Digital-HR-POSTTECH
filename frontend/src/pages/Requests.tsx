import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../api/client";
import type { HRRequest } from "../api/types";
import { Card, Empty, PageHeader, StatusBadge, fmtDate, fmtMoney } from "../components/ui";
import { useI18n } from "../i18n";

export default function Requests() {
  const { t } = useI18n();
  const [items, setItems] = useState<HRRequest[] | null>(null);

  useEffect(() => {
    api.requests("my").then(setItems);
  }, []);

  return (
    <div>
      <PageHeader
        title={t("nav.requests")}
        action={
          <Link to="/requests/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus size={16} /> Новая заявка
          </Link>
        }
      />
      <Card>
        {items === null ? <Empty>{t("common.loading")}</Empty> : items.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-400">
                <tr><th className="pb-2">№</th><th className="pb-2">Тип</th><th className="pb-2">Детали</th><th className="pb-2">Создана</th><th className="pb-2">Статус</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3"><Link to={`/requests/${r.id}`} className="font-medium text-brand-700">{r.id}</Link></td>
                    <td>{t(`type.${r.type}`)}</td>
                    <td className="text-gray-600">
                      {r.type === "vacation"
                        ? `${fmtDate(r.payload.start_date!)} – ${fmtDate(r.payload.end_date!)} (${r.payload.days} дн.)`
                        : fmtMoney(r.payload.amount!)}
                    </td>
                    <td className="text-gray-600">{fmtDate(r.created_at)}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

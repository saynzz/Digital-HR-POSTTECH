import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { EnrollmentStatus, RequestStatus } from "../api/types";
import { useI18n } from "../i18n";

export function Card({ title, action, children, className = "" }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "border border-gray-300 bg-white hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

const statusColor: Record<RequestStatus, string> = {
  pending_manager: "bg-amber-100 text-amber-800",
  pending_hr: "bg-blue-100 text-blue-800",
  approved: "bg-brand-100 text-brand-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}

const enrollLabel: Record<EnrollmentStatus, string> = {
  assigned: "Назначен", in_progress: "В процессе", completed: "Пройден", failed: "Не сдан",
};

export function ProgressBar({ value, status }: { value: number; status?: EnrollmentStatus }) {
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${value}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{status ? enrollLabel[status] : ""}</span>
        <span>{value}%</span>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <p className="py-6 text-center text-sm text-gray-400">{children ?? t("common.empty")}</p>;
}

export function Placeholder({ title, todo, endpoints }: { title: string; todo: string[]; endpoints: string[] }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Раздел в разработке — API уже готов" />
      <Card title="TODO">
        <ul className="list-disc space-y-1 pl-5 text-sm">{todo.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-4 text-xs font-semibold uppercase text-gray-400">Эндпоинты</p>
        <ul className="mt-1 space-y-0.5 font-mono text-xs text-gray-600">{endpoints.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>
    </div>
  );
}

export const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU");
export const fmtMoney = (n: number) => `${n.toLocaleString("ru-RU")} ₸`;

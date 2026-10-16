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

export function Badge({ tone = "gray", children }: {
  tone?: "gray" | "amber" | "green" | "red" | "blue"; children: ReactNode;
}) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-brand-100 text-brand-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 text-2xl leading-none text-gray-400 hover:bg-gray-100" aria-label="Закрыть">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export const inputCls =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 disabled:bg-gray-50";

export function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p> : null;
}

export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { EnrollmentStatus, RequestStatus } from "../api/types";
import { useI18n } from "../i18n";


export function Card({ title, action, children, className = "" }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-[24px] bg-white p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "dark" | "light" }) {
  const pill = variant === "dark" || variant === "light";
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "border border-line bg-white hover:border-gray-400",
    danger: "bg-danger text-white hover:brightness-95",
    dark: "bg-forest text-white hover:bg-forest-2",
    light: "border border-line bg-white text-ink hover:border-forest",
  }[variant];
  const shape = pill ? "rounded-full px-5 py-2.5 font-semibold" : "rounded-xl px-4 py-2 font-medium";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 text-sm transition disabled:opacity-50 ${shape} ${styles} ${className}`}
      {...props}
    />
  );
}

export const buttonClass = (variant: "primary" | "secondary" = "primary") =>
  `inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition ${
    variant === "primary" ? "bg-forest text-white hover:bg-forest-2" : "bg-white text-ink hover:bg-white/70"
  }`;

const statusTone: Record<RequestStatus, { chip: string; dot: string }> = {
  pending_manager: { chip: "bg-signal-50 text-signal-ink", dot: "bg-signal" },
  pending_hr: { chip: "bg-signal-50 text-signal-ink", dot: "bg-signal" },
  approved: { chip: "bg-brand-50 text-brand-700", dot: "bg-brand-600" },
  rejected: { chip: "bg-danger-50 text-danger", dot: "bg-danger" },
  cancelled: { chip: "bg-gray-100 text-muted", dot: "bg-gray-400" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useI18n();
  const tone = statusTone[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tone.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {t(`status.${status}`)}
    </span>
  );
}

const enrollLabel: Record<EnrollmentStatus, string> = {
  assigned: "Назначен", in_progress: "В процессе", completed: "Пройден", failed: "Не сдан",
};

export function ProgressBar({ value, status }: { value: number; status?: EnrollmentStatus }) {
  const bar = status === "failed" ? "bg-danger" : "bg-brand-600";
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${value}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{status ? enrollLabel[status] : ""}</span>
        <span>{value}%</span>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 pt-4">
      <div className="max-w-2xl">
        <h1 className="font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-3 text-[16px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children, action }: { children?: ReactNode; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-muted">{children ?? t("common.empty")}</p>
      {action}
    </div>
  );
}

export function Placeholder({ title, todo, endpoints }: { title: string; todo: string[]; endpoints: string[] }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Раздел скоро появится. Бэкенд уже готов, осталось собрать экран." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Что будет на экране">
          <ol className="space-y-3">
            {todo.map((x, i) => (
              <li key={x} className="flex gap-4 text-[15px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper font-display text-xs font-semibold">{i + 1}</span>
                <span className="pt-0.5">{x}</span>
              </li>
            ))}
          </ol>
        </Card>
        <section className="rounded-[24px] bg-forest p-6 text-white">
          <h2 className="font-display text-[17px] font-semibold">Готовые эндпоинты</h2>
          <ul className="mt-4 space-y-2 text-[13px]">
            {endpoints.map((x) => <li key={x} className="rounded-xl bg-forest-2 px-3 py-2 text-white/85">{x}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

export const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU");
export const fmtShortDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
export const fmtMoney = (n: number) => `${n.toLocaleString("ru-RU")} ₸`;

export const pluralRu = (n: number, [one, few, many]: [string, string, string]) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export function Badge({ tone = "gray", children }: {
  tone?: "gray" | "amber" | "green" | "red" | "blue"; children: ReactNode;
}) {
  const tones = {
    gray: { chip: "bg-gray-100 text-muted", dot: "bg-gray-400" },
    amber: { chip: "bg-signal-50 text-signal-ink", dot: "bg-signal" },
    green: { chip: "bg-brand-50 text-brand-700", dot: "bg-brand-600" },
    red: { chip: "bg-danger-50 text-danger", dot: "bg-danger" },
    blue: { chip: "bg-forest text-white", dot: "bg-signal" },
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tones.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tones.dot}`} />
      {children}
    </span>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-forest/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-[28px] bg-white text-ink sm:rounded-[28px] ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
        style={{ fontFamily: "var(--font-body)" }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <h2 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
          <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-xl leading-none text-muted hover:text-ink" aria-label="Закрыть">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-3">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pb-6 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export const inputCls =
  "mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-[15px] outline-none transition focus:border-forest disabled:bg-paper disabled:text-muted";

export function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="rounded-2xl bg-danger-50 px-4 py-2.5 text-sm text-danger">{children}</p> : null;
}

export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

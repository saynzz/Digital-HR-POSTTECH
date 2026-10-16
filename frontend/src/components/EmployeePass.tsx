import type { Employee } from "../api/types";
import { fmtDate } from "./ui";

export default function EmployeePass({ e }: { e: Employee }) {
  const initials = e.full_name.split(" ").slice(0, 2).map((p) => p[0]).join("");
  return (
    <div className="pass-in perforated w-full max-w-[360px] rotate-[-3deg] rounded-[22px] bg-white text-ink shadow-[0_30px_60px_-20px_rgb(0_0_0/0.45)]">
      <div className="flex items-center justify-between rounded-t-[22px] bg-signal px-6 py-3">
        <span className="font-display text-[13px] font-bold tracking-[-0.01em]">JANA POST</span>
        <span className="text-[12px] font-medium">Пропуск сотрудника</span>
      </div>
      <div className="px-6 pb-5 pt-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-forest font-display text-lg font-bold text-signal">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-display text-[16px] font-semibold leading-tight">{e.full_name.split(" ").slice(0, 2).join(" ")}</p>
            <p className="mt-1 truncate text-[13px] text-muted">{e.position}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-line pt-4 text-[13px]">
          <div><dt className="text-muted">Отдел</dt><dd className="font-medium">{e.department}</dd></div>
          <div><dt className="text-muted">В компании с</dt><dd className="font-medium">{fmtDate(e.hire_date)}</dd></div>
          <div className="col-span-2"><dt className="text-muted">Руководитель</dt><dd className="font-medium">{e.manager?.full_name ?? "—"}</dd></div>
        </dl>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-dashed border-line pt-4">
          <Barcode value={e.external_id} />
          <span className="shrink-0 whitespace-nowrap pb-0.5 text-[12px] font-medium tracking-wide text-muted">{e.external_id}</span>
        </div>
      </div>
    </div>
  );
}

function Barcode({ value }: { value: string }) {
  const bars: number[] = [];
  for (const ch of `*${value}*`) {
    const c = ch.charCodeAt(0);
    for (let i = 0; i < 4; i++) bars.push(((c >> i) & 3) + 1);
  }
  return (
    <div className="flex h-10 min-w-0 items-stretch gap-[2px] overflow-hidden" aria-hidden>
      {bars.map((w, i) => (
        <span key={i} className={i % 2 ? "bg-transparent" : "bg-ink"} style={{ width: w * 1.5 }} />
      ))}
    </div>
  );
}

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Employee } from "../api/types";
import { fmtDate } from "./ui";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function EmployeePass({ e }: { e: Employee }) {
  const [flipped, setFlipped] = useState(() => !reducedMotion());
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const [first, setFirst] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion() || hover) return;
    const delay = flipped ? (first ? 1100 : 3000) : 8000;
    const id = window.setTimeout(() => {
      if (document.hidden) return;
      setFlipped((f) => !f);
      setFirst(false);
    }, delay);
    return () => window.clearTimeout(id);
  }, [flipped, hover, first]);

  const onMove = (ev: MouseEvent) => {
    if (reducedMotion() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 10, y: px * 12 });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={ref} className="pass-in w-[340px] max-w-full rotate-[-3deg] [perspective:1400px]"
        onMouseMove={onMove} onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setTilt({ x: 0, y: 0 }); setHover(false); }}>
        <button type="button" onClick={() => { setFlipped((f) => !f); setFirst(false); }}
          aria-label={flipped ? "Показать данные сотрудника" : "Перевернуть пропуск"}
          className="relative block w-full rounded-[22px] text-left [transform-style:preserve-3d] focus-visible:outline-offset-4"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${(flipped ? 180 : 0) + tilt.y}deg)`,
            transition: "transform 0.8s cubic-bezier(.3,1.25,.4,1)",
          }}>
          <Front e={e} />
          <Back />
        </button>
      </div>
    </div>
  );
}

const face = "perforated rounded-[22px] [backface-visibility:hidden] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.5)]";

function Front({ e }: { e: Employee }) {
  const initials = e.full_name.split(" ").slice(0, 2).map((p) => p[0]).join("");
  return (
    <div className={`${face} bg-white text-ink`}>
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

function Back() {
  return (
    <div className={`${face} absolute inset-0 flex flex-col overflow-hidden bg-signal text-forest [transform:rotateY(180deg)]`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 340 420" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <path d="M-10 330 C 80 280, 120 180, 200 200 S 300 300, 360 240" fill="none" stroke="rgb(15 58 34 / 0.18)" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
        <path d="M-10 90 C 90 130, 170 40, 250 80 S 330 60, 360 50" fill="none" stroke="rgb(15 58 34 / 0.12)" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
      </svg>
      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-forest">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f2c230" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7l9 6 9-6" /><rect x="3" y="5" width="18" height="14" rx="2.5" />
          </svg>
        </span>
        <div>
          <p className="font-display text-[30px] font-bold leading-none tracking-[-0.04em]">JANA POST</p>
          <p className="mt-3 text-[13px] font-medium leading-snug opacity-75">Логистика между Китаем<br />и Центральной Азией</p>
        </div>
      </div>
      <div className="relative flex items-center justify-between border-t border-dashed border-forest/25 px-6 py-3 text-[12px] font-medium">
        <span>JanaMen</span>
        <span className="opacity-70">HR-платформа</span>
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

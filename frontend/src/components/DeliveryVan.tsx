import { useEffect, useRef, useState } from "react";
import { Banknote, Check, Palmtree, Truck } from "lucide-react";
import type { RequestType } from "../api/types";

export type VanPhase = "idle" | "sending" | "error";

export function VanSvg({ doorOpen = false, className = "" }: { doorOpen?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 430 176" className={`van-svg w-full overflow-visible ${className}`} aria-hidden>
      <ellipse cx="170" cy="166" rx="165" ry="8" fill="rgb(0 0 0 / 0.28)" />
      <polygon className="beam" points="338,104 430,78 430,132" fill="url(#beam)" />
      <defs>
        <linearGradient id="beam" x1="0" x2="1">
          <stop offset="0" stopColor="#f2c230" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f2c230" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="10" y="20" width="34" height="104" fill="#0b2b19" className={`van-hold ${doorOpen ? "is-open" : ""}`} />
      <rect x="8" y="14" width="216" height="114" rx="14" fill="#f6f8f3" />
      <rect x="8" y="14" width="216" height="114" rx="14" fill="none" stroke="#d9dfd2" strokeWidth="2" />
      <rect x="8" y="94" width="216" height="15" fill="#f2c230" />
      <rect x="30" y="36" width="36" height="36" rx="10" fill="#0f3a22" />
      <path d="M38 47 l10 7 l10 -7" fill="none" stroke="#f2c230" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="37" y="44" width="22" height="17" rx="3" fill="none" stroke="#f2c230" strokeWidth="2.6" />
      <text x="75" y="61" fontFamily="Unbounded Variable, sans-serif" fontWeight="800" fontSize="19" fill="#0f3a22" letterSpacing="-0.6">JANA POST</text>
      <text x="77" y="81" fontFamily="Onest Variable, sans-serif" fontWeight="600" fontSize="10.5" fill="#5b685d">доставка HR-заявок</text>
      <g className={`rear-door ${doorOpen ? "is-open" : ""}`}>
        <rect x="8" y="18" width="12" height="106" rx="4" fill="#e3e9dd" stroke="#d9dfd2" strokeWidth="1.5" />
        <rect x="12" y="66" width="4" height="12" rx="2" fill="#5b685d" />
      </g>
      <path d="M224 38 h54 c11 0 17 5 22 12 l24 32 c4 6 6 11 6 18 v20 c0 5 -4 8 -8 8 h-98 z" fill="#0f3a22" />
      <path d="M234 48 h40 c6 0 10 3 13 7 l17 23 h-70 z" fill="#9fd3e8" />
      <path d="M240 52 l10 0 l-8 22 l-6 0 z" fill="#ffffff" opacity="0.45" />
      <line x1="272" y1="86" x2="272" y2="124" stroke="#164a2d" strokeWidth="2" />
      <rect x="252" y="94" width="13" height="3.5" rx="1.75" fill="#f2c230" />
      <rect x="303" y="58" width="7" height="16" rx="3" fill="#0f3a22" />
      <rect x="320" y="96" width="12" height="9" rx="3" fill="#f2c230" className="headlight" />
      <rect x="2" y="124" width="334" height="12" rx="6" fill="#164a2d" />
      <rect x="0" y="128" width="10" height="5" rx="2" fill="#5b685d" />
      {[72, 272].map((cx) => (
        <g key={cx} className="wheel">
          <circle cx={cx} cy="140" r="25" fill="#17251a" />
          <circle cx={cx} cy="140" r="13" fill="#d9dfd2" />
          <rect x={cx - 1.75} y="127" width="3.5" height="26" fill="#5b685d" />
          <rect x={cx - 13} y="138.25" width="26" height="3.5" fill="#5b685d" />
          <circle cx={cx} cy="140" r="4.5" fill="#0f3a22" />
        </g>
      ))}
    </svg>
  );
}

function Parcel({ type, label, sub, big = false }: { type: RequestType; label: string; sub?: string; big?: boolean }) {
  const Icon = type === "vacation" ? Palmtree : Banknote;
  return (
    <div className={`relative flex flex-col items-center justify-center rounded-[14px] bg-signal text-forest shadow-[0_18px_30px_-12px_rgb(0_0_0/0.5)] ${
      big ? "h-[150px] w-[180px] sm:h-[170px] sm:w-[210px]" : "h-[74px] w-[86px] sm:h-[86px] sm:w-[100px]"}`}>
      <span className="absolute inset-x-0 top-[30%] h-[3px] bg-forest/15" />
      <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-forest/15" />
      <span className={`relative flex items-center justify-center rounded-xl bg-forest text-signal ${big ? "h-12 w-12" : "h-8 w-8"}`}>
        <Icon size={big ? 24 : 16} />
      </span>
      <span className={`relative mt-1.5 font-display font-bold uppercase tracking-tight ${big ? "text-[17px]" : "text-[11px]"}`}>{label}</span>
      {sub && <span className={`relative font-semibold opacity-75 ${big ? "text-[12px]" : "text-[9px]"}`}>{sub}</span>}
    </div>
  );
}

function Skyline({ tone, heights, gap = 8 }: { tone: string; heights: number[]; gap?: number }) {
  const w = heights.length * (40 + gap);
  return (
    <svg viewBox={`0 0 ${w} 140`} preserveAspectRatio="none" className="h-full w-1/2 shrink-0" aria-hidden>
      {heights.map((h, i) => (
        <g key={i}>
          <rect x={i * (40 + gap)} y={140 - h} width="40" height={h} rx="4" fill={tone} />
          {h > 60 && [0, 1, 2].map((r) => (
            <rect key={r} x={i * (40 + gap) + 10 + (r % 2) * 12} y={150 - h + r * 18} width="6" height="8" rx="1" fill="#f2c230" opacity={(i + r) % 3 === 0 ? 0.55 : 0.12} />
          ))}
        </g>
      ))}
    </svg>
  );
}

const FAR = [70, 110, 54, 128, 86, 64, 118, 92, 58, 136, 76, 100, 62, 122, 84, 70];
const NEAR = [40, 66, 30, 54, 44, 72, 36, 58, 48, 34, 62, 42];

function City({ moving, slow = false }: { moving: boolean; slow?: boolean }) {
  return (
    <>
      <div className={`city-layer absolute inset-x-0 bottom-[30%] flex h-[42%] w-[200%] ${moving ? (slow ? "is-moving-slow" : "is-moving-far") : ""}`}>
        <Skyline tone="#164a2d" heights={FAR} />
        <Skyline tone="#164a2d" heights={FAR} />
      </div>
      <div className={`city-layer absolute inset-x-0 bottom-[30%] flex h-[24%] w-[200%] ${moving ? (slow ? "is-moving-slow2" : "is-moving-near") : ""}`}>
        <Skyline tone="#1c5636" heights={NEAR} gap={26} />
        <Skyline tone="#1c5636" heights={NEAR} gap={26} />
      </div>
    </>
  );
}

function Road({ moving }: { moving: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[#0b2b19]">
      <div className="absolute inset-x-0 top-0 h-[6px] bg-[#164a2d]" />
      <div className={`lane absolute inset-x-0 top-[42%] h-[5px] ${moving ? "is-moving" : ""}`} />
    </div>
  );
}

export function DeliveryScene({ phase, type, label, sub, caption }: {
  phase: VanPhase; type: RequestType; label: string; sub?: string; caption: string;
}) {
  return (
    <div className="delivery-scene relative h-[230px] overflow-hidden rounded-[28px] bg-gradient-to-b from-forest to-[#123f26] sm:h-[270px]" aria-hidden>
      <div className="absolute right-[8%] top-[14%] h-14 w-14 rounded-full bg-signal/90 shadow-[0_0_60px_10px_rgb(242_194_48/0.25)] sm:h-16 sm:w-16" />
      <div className="cloud absolute left-[8%] top-[16%] h-5 w-24 rounded-full bg-white/10" />
      <div className="cloud cloud-2 absolute left-[46%] top-[28%] h-4 w-16 rounded-full bg-white/[0.07]" />
      <City moving slow />
      <Road moving={false} />
      <div className="absolute left-5 top-4 z-10 sm:left-7 sm:top-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-signal">Склад отправки</p>
        <p className="mt-1 max-w-[220px] font-display text-[15px] font-semibold leading-snug text-white sm:max-w-none sm:text-[18px]">{caption}</p>
      </div>
      <div className={`absolute bottom-[19%] left-[5%] z-10 sm:left-[9%] ${phase === "error" ? "parcel-bounce" : "parcel-idle"}`} key={`${label}-${sub}`}>
        <div className="parcel-pop"><Parcel type={type} label={label} sub={sub} /></div>
      </div>
      <div className={`absolute bottom-[9%] right-[-4%] z-10 w-[64%] sm:right-[6%] sm:w-[400px] ${phase === "error" ? "van-shake" : "van-idle"}`}>
        <VanSvg doorOpen />
      </div>
    </div>
  );
}

type Stage = "stamp" | "load" | "drive" | "exit" | "done";

export function DispatchOverlay({ type, label, sub, stops, requestId, onFinish }: {
  type: RequestType; label: string; sub?: string; stops: string[]; requestId: number | null; onFinish: () => void;
}) {
  const [stage, setStage] = useState<Stage>("stamp");
  const [minDrive, setMinDrive] = useState(false);

  useEffect(() => {
    const t = [
      setTimeout(() => setStage("load"), 900),
      setTimeout(() => setStage("drive"), 1550),
      setTimeout(() => setMinDrive(true), 1550 + 2300),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    if (stage === "drive" && minDrive && requestId !== null) setStage("exit");
  }, [stage, minDrive, requestId]);

  useEffect(() => {
    if (stage === "exit") {
      const t = setTimeout(() => setStage("done"), 650);
      return () => clearTimeout(t);
    }
    if (stage === "done") {
      const t = setTimeout(() => finishRef.current(), 1500);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const moving = stage === "drive" || stage === "exit";
  const captions: Record<Stage, string> = {
    stamp: "Оформляем накладную",
    load: "Грузим посылку в фургон",
    drive: `Везём по маршруту: ${stops.join(" → ")}`,
    exit: "Полный вперёд!",
    done: "",
  };

  return (
    <div className="dispatch fixed inset-0 z-[70] overflow-hidden bg-gradient-to-b from-[#0a2c19] via-forest to-[#123f26] text-white" role="status" aria-live="polite">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="star absolute h-1 w-1 rounded-full bg-white/40"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 38 + 4}%`, animationDelay: `${(i % 5) * 0.4}s` }} />
      ))}
      <div className="absolute right-[10%] top-[10%] h-24 w-24 rounded-full bg-signal shadow-[0_0_90px_20px_rgb(242_194_48/0.25)] sm:h-32 sm:w-32">
        <span className="absolute left-[24%] top-[30%] h-4 w-4 rounded-full bg-[#e0ae20]" />
        <span className="absolute left-[56%] top-[56%] h-6 w-6 rounded-full bg-[#e0ae20]" />
      </div>

      <City moving={moving} />
      <Road moving={moving} />

      {stage === "drive" && stops.map((s, i) => (
        <div key={s} className="signpost absolute bottom-[28%] right-0 z-10" style={{ animationDelay: `${i * 0.75}s` }}>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 rounded-xl border-2 border-forest bg-signal px-4 py-2 font-display text-[15px] font-bold text-forest shadow-lg sm:text-[18px]">
              {s} <Check size={16} strokeWidth={3} />
            </div>
            <div className="h-20 w-1.5 bg-[#d9dfd2] sm:h-28" />
          </div>
        </div>
      ))}

      {stage === "exit" && Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="speed-line absolute left-0 h-[3px] rounded-full bg-white/50"
          style={{ top: `${46 + (i * 7) % 26}%`, width: `${18 + (i * 13) % 30}%`, animationDelay: `${i * 0.05}s` }} />
      ))}

      <div className={`absolute bottom-[17%] left-1/2 z-20 w-[min(560px,86vw)] ${
        stage === "drive" ? "van-drive-loop" : stage === "exit" || stage === "done" ? "van-exit" : "van-arrive"}`}>
        <div className={moving ? "van-moving" : ""}>
          <VanSvg doorOpen={stage === "stamp" || stage === "load"} />
          {moving && (
            <div className="exhaust absolute -left-6 bottom-[22%] flex gap-1.5">
              <span className="puff h-5 w-5 rounded-full bg-white/30" />
              <span className="puff puff-2 h-4 w-4 rounded-full bg-white/25" />
              <span className="puff puff-3 h-3 w-3 rounded-full bg-white/20" />
            </div>
          )}
        </div>
      </div>

      {(stage === "stamp" || stage === "load") && (
        <div className={`absolute left-1/2 top-[16%] z-30 sm:top-[14%] ${stage === "load" ? "parcel-fly" : "parcel-drop"}`}>
          <Parcel type={type} label={label} sub={sub} big />
          <span className="stamp absolute -right-8 -top-6 rotate-[-14deg] rounded-xl border-[4px] border-danger bg-white/90 px-3 py-1 font-display text-[20px] font-black tracking-tight text-danger sm:text-[24px]">
            ПРИНЯТО
          </span>
        </div>
      )}

      {stage !== "done" && (
        <div className="absolute left-0 right-0 top-6 z-40 px-6 text-center sm:top-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Jana Post · доставка заявки</p>
          <p key={stage} className="rise-in mt-2 font-display text-[20px] font-bold tracking-[-0.02em] sm:text-[28px]">{captions[stage]}</p>
        </div>
      )}

      {stage === "done" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-6">
          <div className="done-card flex flex-col items-center rounded-[32px] bg-white px-10 py-9 text-center text-ink shadow-2xl">
            <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-signal text-forest"><Truck size={36} /></span>
            <p className="mt-5 font-display text-[28px] font-bold tracking-[-0.03em] sm:text-[34px]">Заявка №{requestId} в пути</p>
            <p className="mt-2 text-muted">{stops[0] === "Руководитель" ? "Руководитель уже получил уведомление" : "Заявка передана в HR"}</p>
          </div>
        </div>
      )}

      {requestId !== null && stage !== "done" && (
        <button onClick={onFinish} className="absolute bottom-5 right-5 z-50 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20">
          Пропустить
        </button>
      )}
    </div>
  );
}

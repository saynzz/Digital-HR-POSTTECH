import { Banknote, Palmtree } from "lucide-react";
import type { RequestType } from "../api/types";

export type VanPhase = "idle" | "loading" | "driving" | "error";

export default function DeliveryScene({ phase, type, label }: { phase: VanPhase; type: RequestType; label: string }) {
  const Icon = type === "vacation" ? Palmtree : Banknote;
  return (
    <div className={`delivery-scene relative h-[170px] overflow-hidden rounded-[24px] bg-forest ${phase === "driving" ? "is-driving" : ""}`} aria-hidden>
      <div className="absolute inset-x-0 bottom-[34px] h-[2px] bg-white/10" />
      <div className="road-dashes absolute inset-x-0 bottom-[22px] h-[3px]" />
      <div className="absolute inset-x-0 bottom-0 h-[22px] bg-forest-2" />

      <div className={`parcel absolute bottom-[46px] left-[34px] flex h-[52px] w-[60px] flex-col items-center justify-center rounded-[10px] bg-signal text-forest shadow-lg ${
        phase === "loading" || phase === "driving" ? "parcel-load" : ""} ${phase === "error" ? "parcel-bounce" : ""}`}>
        <Icon size={20} strokeWidth={2.2} />
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide">{label}</span>
        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-[14px] bg-forest/20" />
      </div>

      <div className={`van absolute bottom-[14px] left-[118px] w-[230px] ${phase === "idle" ? "van-idle" : ""} ${
        phase === "driving" ? "van-drive" : ""} ${phase === "error" ? "van-shake" : ""}`}>
        <div className="exhaust absolute -left-3 bottom-[30px] flex gap-1">
          <span className="puff h-3 w-3 rounded-full bg-white/30" />
          <span className="puff puff-2 h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="puff puff-3 h-2 w-2 rounded-full bg-white/20" />
        </div>
        <svg viewBox="0 0 230 110" className="w-full overflow-visible">
          <rect x="4" y="12" width="150" height="70" rx="10" fill="#f6f8f3" />
          <rect x="4" y="12" width="150" height="70" rx="10" fill="none" stroke="#d9dfd2" strokeWidth="2" />
          <rect x="4" y="56" width="150" height="12" fill="#f2c230" />
          <text x="79" y="45" textAnchor="middle" fontFamily="Unbounded Variable, sans-serif" fontWeight="800" fontSize="17" fill="#0f3a22" letterSpacing="-0.5">JANA POST</text>
          <rect x="10" y="20" width="6" height="40" rx="3" fill="#d9dfd2" className={`van-door ${phase === "loading" ? "door-open" : ""}`} />
          <path d="M154 26 h34 c8 0 13 4 17 10 l14 20 c3 4 5 8 5 13 v6 c0 4 -3 7 -7 7 h-63 z" fill="#0f3a22" />
          <path d="M162 34 h24 c5 0 8 2 11 6 l10 14 h-45 z" fill="#9fd3e8" opacity="0.9" />
          <rect x="214" y="66" width="10" height="6" rx="2" fill="#f2c230" />
          <rect x="0" y="78" width="226" height="8" rx="4" fill="#164a2d" />
          <g className="wheel">
            <circle cx="46" cy="88" r="16" fill="#17251a" />
            <circle cx="46" cy="88" r="7" fill="#d9dfd2" />
            <rect x="44.5" y="74" width="3" height="28" fill="#5b685d" />
          </g>
          <g className="wheel">
            <circle cx="182" cy="88" r="16" fill="#17251a" />
            <circle cx="182" cy="88" r="7" fill="#d9dfd2" />
            <rect x="180.5" y="74" width="3" height="28" fill="#5b685d" />
          </g>
        </svg>
      </div>
    </div>
  );
}

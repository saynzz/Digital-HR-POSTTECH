import { Check, X } from "lucide-react";
import type { RequestStatus } from "../api/types";
import { useI18n, type TKey } from "../i18n";


type Node = { key: TKey; state: "done" | "current" | "todo" | "stopped" | "off" };

const STAGES: TKey[] = ["track.submitted", "track.manager", "track.hr", "track.done"];

function nodesFor(status: RequestStatus): Node[] {
  const at = { pending_manager: 1, pending_hr: 2, approved: 4 } as Record<RequestStatus, number>;
  if (status === "rejected" || status === "cancelled") {
    return [
      { key: "track.submitted", state: "done" },
      { key: status === "rejected" ? "status.rejected" : "status.cancelled", state: status === "rejected" ? "stopped" : "off" },
    ];
  }
  const pos = at[status];
  return STAGES.map((key, i) => ({ key, state: i < pos ? "done" : i === pos ? "current" : "todo" }));
}

export default function RouteTrack({ status, compact = false }: { status: RequestStatus; compact?: boolean }) {
  const { t } = useI18n();
  const nodes = nodesFor(status);

  return (
    <ol className={`flex w-full items-start ${compact ? "" : "pb-6"}`} aria-label={t(`status.${status}`)}>
      {nodes.map((n, i) => {
        const last = i === nodes.length - 1;
        const lineDone = !last && nodes[i + 1].state !== "todo" && n.state === "done";
        return (
          <li key={n.key} className={`relative flex flex-col ${last ? "" : "flex-1"}`}
            aria-current={n.state === "current" ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={`flex ${n.state === "todo" ? "" : "route-pop"}`} style={{ animationDelay: `${i * 220}ms` }}>
                <Dot state={n.state} />
              </span>
              {!last && (
                <span className="relative mx-1 h-[2px] flex-1 rounded-full bg-[repeating-linear-gradient(90deg,var(--color-line)_0_6px,transparent_6px_10px)]">
                  {lineDone && (
                    <span className={`route-fill absolute inset-0 rounded-full ${nodes[i + 1].state === "stopped" || nodes[i + 1].state === "off" ? "bg-brand-600" : "bg-brand-600"}`}
                      style={{ animationDelay: `${i * 220 + 110}ms` }} />
                  )}
                </span>
              )}
            </div>
            {!compact && (
              <span className={`absolute top-[22px] whitespace-nowrap text-[11px] leading-none ${
                i === 0 ? "left-0" : last ? "right-0" : "left-[7px] -translate-x-1/2"
              } ${
                n.state === "current" ? "font-semibold text-ink" :
                n.state === "stopped" ? "font-semibold text-danger" :
                n.state === "todo" ? "text-gray-400" : "text-muted"
              }`}>
                {t(n.key)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Dot({ state }: { state: Node["state"] }) {
  const base = "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full";
  switch (state) {
    case "done":
      return <span className={`${base} bg-brand-600 text-white`}><Check size={9} strokeWidth={4} /></span>;
    case "current":
      return <span className={`${base} route-current border-[3px] border-signal bg-white`} />;
    case "stopped":
      return <span className={`${base} bg-danger text-white`}><X size={9} strokeWidth={4} /></span>;
    case "off":
      return <span className={`${base} bg-gray-300 text-white`}><X size={9} strokeWidth={4} /></span>;
    default:
      return <span className={`${base} border-2 border-line bg-white`} />;
  }
}

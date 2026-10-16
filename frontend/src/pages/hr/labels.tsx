import type { AccountStatus, CandidateStatus } from "../../api/types";
import { Badge } from "../../components/ui";

export const CANDIDATE_STATUS: Record<CandidateStatus, { label: string; tone: "gray" | "amber" | "green" | "red" | "blue" }> = {
  interview_pending: { label: "Ожидает собеседования", tone: "amber" },
  interview_passed: { label: "Прошёл собеседование", tone: "green" },
  interview_failed: { label: "Не прошёл собеседование", tone: "red" },
  hired: { label: "Трудоустроен", tone: "blue" },
  archived: { label: "Откреплён", tone: "gray" },
};

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: "amber" | "green" | "red" }> = {
  invited: { label: "Ожидает активации", tone: "amber" },
  active: { label: "Активен", tone: "green" },
  blocked: { label: "Заблокирован", tone: "red" },
};

export function CandidateBadge({ status }: { status: CandidateStatus }) {
  const s = CANDIDATE_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function AccountBadge({ status }: { status: AccountStatus }) {
  const s = ACCOUNT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

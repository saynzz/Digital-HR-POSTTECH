import { useSearchParams } from "react-router-dom";
import { DatabaseZap, Gift, KeyRound, UserSearch } from "lucide-react";
import { PageHeader } from "../../components/ui";
import Accounts from "./Accounts";
import Candidates from "./Candidates";
import ImportEmployees from "./ImportEmployees";
import RewardsAdmin from "./RewardsAdmin";

const TABS = [
  { id: "candidates", label: "Кандидаты", icon: UserSearch },
  { id: "accounts", label: "Доступы", icon: KeyRound },
  { id: "import", label: "Импорт сотрудников", icon: DatabaseZap },
  { id: "rewards", label: "Награды и цели", icon: Gift },
] as const;

export default function HRPanel() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab = raw === "accounts" || raw === "rewards" || raw === "import" ? raw : "candidates";

  return (
    <div>
      <PageHeader title="HR-панель" subtitle="Кандидаты, трудоустройство, доступы, награды и цели отделов" />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-white p-1 sm:inline-flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setParams(id === "candidates" ? {} : { tab: id })}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition sm:flex-none ${
              tab === id ? "bg-forest text-white" : "text-muted hover:text-ink"
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === "candidates" ? <Candidates /> : tab === "accounts" ? <Accounts /> : tab === "import" ? <ImportEmployees /> : <RewardsAdmin />}
    </div>
  );
}

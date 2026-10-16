import { useSearchParams } from "react-router-dom";
import { KeyRound, UserSearch } from "lucide-react";
import { PageHeader } from "../../components/ui";
import Accounts from "./Accounts";
import Candidates from "./Candidates";

const TABS = [
  { id: "candidates", label: "Кандидаты", icon: UserSearch },
  { id: "accounts", label: "Доступы", icon: KeyRound },
] as const;

export default function HRPanel() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "accounts" ? "accounts" : "candidates";

  return (
    <div>
      <PageHeader title="HR-панель" subtitle="Кандидаты, трудоустройство и доступ сотрудников к JanaMen" />
      <div className="mb-6 flex gap-1 rounded-full bg-white p-1 sm:inline-flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setParams(id === "candidates" ? {} : { tab: id })}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition sm:flex-none ${
              tab === id ? "bg-forest text-white" : "text-muted hover:text-ink"
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === "candidates" ? <Candidates /> : <Accounts />}
    </div>
  );
}

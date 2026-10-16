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
      <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1 sm:inline-flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setParams(id === "candidates" ? {} : { tab: id })}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${
              tab === id ? "bg-white text-ink shadow-sm" : "text-gray-500 hover:text-ink"
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {tab === "candidates" ? <Candidates /> : <Accounts />}
    </div>
  );
}

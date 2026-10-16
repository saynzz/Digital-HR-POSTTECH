import { useEffect, useState } from "react";
import { Ban, KeyRound, Search, Send, Unlock } from "lucide-react";
import { api } from "../../api/client";
import type { Account, InviteResult } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, Card, Empty, ErrorText, Modal, fmtDateTime } from "../../components/ui";
import { useI18n } from "../../i18n";
import InviteLinkBox from "./InviteLinkBox";
import { AccountBadge } from "./labels";

export default function Accounts() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Account[] | null>(null);
  const [query, setQuery] = useState("");
  const [invite, setInvite] = useState<{ account: Account; result: InviteResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => api.accounts().then(setItems);
  useEffect(() => { load(); }, []);

  const act = async (a: Account, fn: () => Promise<unknown>) => {
    setBusyId(a.user_id);
    setError(null);
    try {
      const res = await fn();
      if (res && typeof res === "object" && "sent_to" in res) setInvite({ account: a, result: res as InviteResult });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const visible = (items ?? []).filter((a) => {
    const q = query.trim().toLowerCase();
    return !q || [a.employee.full_name, a.email, a.employee.department].some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по ФИО, email, подразделению"
          className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
      </div>
      <ErrorText>{error}</ErrorText>
      <Card className="!p-0 overflow-hidden">
        {items === null ? <Empty>Загрузка…</Empty> : visible.length === 0 ? <Empty /> : (
          <ul className="divide-y divide-gray-100">
            {visible.map((a) => {
              const self = a.user_id === user?.id;
              const busy = busyId === a.user_id;
              return (
                <li key={a.user_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.employee.full_name}</p>
                      <AccountBadge status={a.status} />
                      <span className="text-xs text-gray-400">{t(`role.${a.role}`)}</span>
                    </div>
                    <p className="truncate text-sm text-gray-500">{a.email} · {a.employee.department}</p>
                    {a.status === "invited" && a.invite_sent_at && (
                      <p className="text-xs text-gray-400">
                        {a.invite_pending
                          ? `Ссылка отправлена ${fmtDateTime(a.invite_sent_at)}, действует до ${fmtDateTime(a.invite_expires_at!)}`
                          : "Срок ссылки истёк — отправьте новую"}
                      </p>
                    )}
                  </div>
                  {!self && (
                    <div className="flex flex-wrap gap-2">
                      {a.status === "invited" && (
                        <Button variant="secondary" disabled={busy} onClick={() => act(a, () => api.sendInvite(a.user_id))}>
                          <Send size={16} /> Отправить ссылку
                        </Button>
                      )}
                      {a.status === "active" && (
                        <Button variant="secondary" disabled={busy} onClick={() => act(a, () => api.sendInvite(a.user_id))}>
                          <KeyRound size={16} /> Сбросить пароль
                        </Button>
                      )}
                      {a.status !== "blocked" ? (
                        <Button variant="secondary" disabled={busy} onClick={() => act(a, () => api.blockAccount(a.user_id))}>
                          <Ban size={16} className="text-red-600" /> Заблокировать
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled={busy} onClick={() => act(a, () => api.unblockAccount(a.user_id))}>
                          <Unlock size={16} /> Разблокировать
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={!!invite} onClose={() => setInvite(null)} title={invite?.account.status === "active" ? "Ссылка для сброса пароля" : "Ссылка для создания пароля"}
        footer={<Button onClick={() => setInvite(null)}>Готово</Button>}>
        {invite && (
          <div className="space-y-3">
            <p className="text-sm">{invite.account.employee.full_name}. Предыдущие ссылки больше не действуют.</p>
            <InviteLinkBox invite={invite.result} />
          </div>
        )}
      </Modal>
    </div>
  );
}

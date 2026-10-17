import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { api } from "../../api/client";
import type { RedemptionItem, RewardItem, TeamGoal } from "../../api/types";
import { Coin, GoalCard, GoalModal, REWARD_ICON_KEYS, rewardIcon } from "../../components/Motivation";
import { Button, Card, Empty, ErrorText, Field, Modal, fmtDate, inputCls } from "../../components/ui";

type Draft = Omit<RewardItem, "id">;
const EMPTY: Draft = { title: "", description: "", cost: 200, icon: "gift", stock: null, active: true };

export default function RewardsAdmin() {
  const [queue, setQueue] = useState<RedemptionItem[] | null>(null);
  const [catalog, setCatalog] = useState<RewardItem[]>([]);
  const [goals, setGoals] = useState<{ department: string; goal: TeamGoal | null }[]>([]);
  const [edit, setEdit] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [goalDep, setGoalDep] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.adminRedemptions().then(setQueue);
    api.adminRewards().then(setCatalog);
    api.goals().then(setGoals);
  };
  useEffect(load, []);

  const decide = async (r: RedemptionItem, approve: boolean) => {
    await api.decideRedemption(r.id, approve, comments[r.id]);
    load();
  };

  const save = async () => {
    if (!edit) return;
    setError(null);
    try {
      if (edit.id === null) await api.createReward(edit.draft);
      else await api.updateReward(edit.id, edit.draft);
      setEdit(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pending = (queue ?? []).filter((r) => r.status === "pending");
  const decided = (queue ?? []).filter((r) => r.status !== "pending").slice(0, 8);
  const d = edit?.draft;
  const set = (patch: Partial<Draft>) => setEdit((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card title={<span className="flex items-center gap-3">Обмен коинов
          {pending.length > 0 && <span className="rounded-full bg-signal px-2.5 py-0.5 font-body text-xs font-bold text-forest">{pending.length}</span>}</span>}>
          {queue === null ? <Empty>Загрузка…</Empty> : pending.length === 0 ? <Empty>Новых заявок на награды нет.</Empty> : (
            <ul className="space-y-3">
              {pending.map((r) => {
                const Icon = rewardIcon(r.reward.icon);
                return (
                  <li key={r.id} className="rounded-[20px] border border-line p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-signal text-forest"><Icon size={20} /></span>
                      <span className="min-w-0 flex-1">
                        <b className="block">{r.reward.title}</b>
                        <span className="block text-[12.5px] text-muted">{r.employee.name} · {r.employee.department} · {fmtDate(r.created_at)}</span>
                      </span>
                      <span className="flex items-center gap-1 font-display font-bold"><Coin size={16} /> {r.cost}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input className={`${inputCls} min-w-[200px] flex-1 !py-2`} placeholder="Комментарий сотруднику (необязательно)"
                        value={comments[r.id] ?? ""} onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))} />
                      <Button variant="dark" onClick={() => decide(r, true)}><Check size={16} /> Одобрить</Button>
                      <Button variant="light" onClick={() => decide(r, false)}><X size={16} /> Отклонить</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {decided.length > 0 && (
            <div className="mt-5 border-t border-dashed border-line pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Недавние решения</p>
              <ul className="space-y-1.5 text-[13px]">
                {decided.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span className="truncate">{r.employee.name} — {r.reward.title}</span>
                    <span className={r.status === "approved" ? "text-brand-700" : "text-muted"}>
                      {r.status === "approved" ? "одобрено" : r.status === "rejected" ? "отклонено" : "отменено"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <p className="font-display text-[18px] font-bold">Цели отделов</p>
          {goals.map((g) => (
            <GoalCard key={g.department} goal={g.goal} compact department={g.department} onEdit={() => setGoalDep(g.department)} />
          ))}
        </div>
      </div>

      <Card title="Каталог наград" action={<Button variant="dark" onClick={() => setEdit({ id: null, draft: { ...EMPTY } })}><Plus size={16} /> Добавить</Button>}>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted">
                <th className="pb-2 font-medium">Награда</th>
                <th className="pb-2 text-right font-medium">Цена</th>
                <th className="pb-2 text-right font-medium">Остаток</th>
                <th className="pb-2 text-right font-medium">Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalog.map((r) => {
                const Icon = rewardIcon(r.icon);
                return (
                  <tr key={r.id} className="border-t border-dashed border-line">
                    <td className="py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-forest"><Icon size={17} /></span>
                        <span><b className="block">{r.title}</b><span className="block text-[12px] text-muted">{r.description}</span></span>
                      </span>
                    </td>
                    <td className="text-right font-semibold">{r.cost}</td>
                    <td className="text-right">{r.stock ?? "∞"}</td>
                    <td className="text-right">
                      <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${r.active ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-muted"}`}>
                        {r.active ? "в магазине" : "скрыта"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => setEdit({ id: r.id, draft: { title: r.title, description: r.description, cost: r.cost, icon: r.icon, stock: r.stock, active: r.active } })}
                        className="rounded-full px-3 py-1 text-[12.5px] font-semibold text-forest hover:bg-paper">Изменить</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id === null ? "Новая награда" : "Награда"}
        footer={<><Button variant="light" onClick={() => setEdit(null)}>Отмена</Button><Button variant="dark" disabled={!d || d.title.length < 2 || d.cost < 1} onClick={save}>Сохранить</Button></>}>
        {d && (
          <div className="space-y-4">
            <Field label="Название"><input className={inputCls} value={d.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Описание"><textarea className={`${inputCls} min-h-16`} value={d.description} onChange={(e) => set({ description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Цена, коинов"><input type="number" min={1} className={inputCls} value={d.cost} onChange={(e) => set({ cost: Number(e.target.value) })} /></Field>
              <Field label="Остаток" hint="Пусто — без ограничений">
                <input type="number" min={0} className={inputCls} value={d.stock ?? ""} onChange={(e) => set({ stock: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Иконка</p>
              <div className="flex flex-wrap gap-2">
                {REWARD_ICON_KEYS.map((k) => {
                  const Icon = rewardIcon(k);
                  return (
                    <button key={k} type="button" onClick={() => set({ icon: k })}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${d.icon === k ? "bg-forest text-signal" : "bg-paper text-forest hover:bg-line"}`}><Icon size={18} /></button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--color-forest)]" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> Показывать в магазине
            </label>
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Modal>

      <GoalModal open={!!goalDep} onClose={() => setGoalDep(null)} department={goalDep ?? undefined}
        current={goals.find((g) => g.department === goalDep)?.goal ?? null}
        onSaved={() => { setGoalDep(null); load(); }} />
    </div>
  );
}

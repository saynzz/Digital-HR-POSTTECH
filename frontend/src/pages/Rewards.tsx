import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, GraduationCap, Heart, Store } from "lucide-react";
import { api } from "../api/client";
import type { KudosItem, MotivationSummary, RedemptionItem, RewardItem, Rewards as RewardsT, TeamGoal } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { RewardLayer } from "../components/Game";
import { Coin, GoalCard, GoalModal, KudosCard, KudosComposer, rewardIcon } from "../components/Motivation";
import { useCountUp } from "../components/useCountUp";
import { Button, Card, Empty, Modal, PageHeader, fmtDate } from "../components/ui";

const R_STATUS: Record<RedemptionItem["status"], { label: string; cls: string }> = {
  pending: { label: "Ждёт HR", cls: "bg-signal-50 text-signal-ink" },
  approved: { label: "Одобрено", cls: "bg-brand-50 text-brand-700" },
  rejected: { label: "Отклонено", cls: "bg-danger-50 text-danger" },
  cancelled: { label: "Отменено", cls: "bg-gray-100 text-muted" },
};

export default function Rewards() {
  const { user } = useAuth();
  const [s, setS] = useState<MotivationSummary | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [mine, setMine] = useState<RedemptionItem[]>([]);
  const [feed, setFeed] = useState<KudosItem[]>([]);
  const [scope, setScope] = useState<"all" | "me" | "team">("all");
  const [confirm, setConfirm] = useState<RewardItem | null>(null);
  const [done, setDone] = useState<RedemptionItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<RewardsT | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const closeReward = useCallback(() => setReward(null), []);
  const isLead = user?.role === "manager" || user?.role === "hr";

  const load = () => {
    api.motivation().then(setS);
    api.rewards().then(setItems);
    api.myRedemptions().then(setMine);
  };
  useEffect(load, []);
  useEffect(() => { api.kudos(scope).then(setFeed); }, [scope]);

  const redeem = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.redeem(confirm.id);
      setDone(r);
      setConfirm(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (r: RedemptionItem) => {
    await api.cancelRedemption(r.id);
    load();
  };

  const sent = (k: KudosItem, r: RewardsT | null, left: number) => {
    setFeed((f) => [k, ...f]);
    setS((x) => (x ? { ...x, kudos_left: left } : x));
    if (r) setReward(r);
    api.motivation().then(setS);
  };

  const savedGoal = (g: TeamGoal) => {
    setGoalOpen(false);
    setS((x) => (x ? { ...x, goal: g } : x));
  };

  if (!s) return <Card className="mt-6"><Empty>Загрузка…</Empty></Card>;

  return (
    <div className="space-y-8">
      <RewardLayer rewards={reward} onClose={closeReward} />
      <PageHeader title="Награды" subtitle="Коины за обучение и благодарности, общая цель отдела и магазин наград." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Wallet s={s} />
        <GoalCard goal={s.goal} onEdit={isLead ? () => setGoalOpen(true) : undefined} />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[22px] font-bold tracking-[-0.02em]"><Store size={22} /> Магазин наград</h2>
            <p className="mt-1 text-sm text-muted">Обмен подтверждает HR. Если откажут — коины вернутся.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((it) => {
            const Icon = rewardIcon(it.icon);
            const can = s.coins >= it.cost && (it.stock === null || it.stock > 0);
            const need = Math.max(it.cost - s.coins, 0);
            return (
              <div key={it.id} className={`flex flex-col rounded-[24px] p-5 ${can ? "bg-white" : "bg-white/70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${can ? "bg-signal text-forest" : "bg-paper text-forest"}`}><Icon size={24} /></span>
                  {it.stock !== null && <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-medium text-muted">осталось {it.stock}</span>}
                </div>
                <p className="mt-4 font-display text-[16px] font-bold leading-snug">{it.title}</p>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{it.description}</p>
                <div className="mt-auto pt-4">
                  <p className="flex items-center gap-1.5 font-display text-[20px] font-bold"><Coin size={20} /> {it.cost}</p>
                  {can ? (
                    <button onClick={() => { setError(null); setConfirm(it); }}
                      className="mt-3 w-full rounded-full bg-forest py-2.5 text-[14px] font-semibold text-white transition hover:bg-forest-2">Обменять</button>
                  ) : (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-paper">
                        <div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(100, (s.coins / it.cost) * 100)}%` }} />
                      </div>
                      <p className="mt-1.5 text-[12px] text-muted">{it.stock === 0 ? "Закончилось" : `Ещё ${need} коинов`}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {mine.length > 0 && (
          <Card title="Мои обмены" className="mt-5">
            <ul className="divide-y divide-line">
              {mine.map((r) => {
                const Icon = rewardIcon(r.reward.icon);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-forest"><Icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[14px]">{r.reward.title}</b>
                      <span className="block text-[12px] text-muted">{fmtDate(r.created_at)} · {r.cost} коинов{r.comment ? ` · ${r.comment}` : ""}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${R_STATUS[r.status].cls}`}>{R_STATUS[r.status].label}</span>
                    {r.status === "pending" && <button onClick={() => cancel(r)} className="text-[12px] font-semibold text-muted hover:text-danger">Отменить</button>}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <KudosComposer summary={s} onSent={sent} />
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-[22px] font-bold tracking-[-0.02em]"><Heart size={21} /> Лента благодарностей</h2>
            <div className="flex rounded-full bg-white p-1">
              {([["all", "Все"], ["team", "Мой отдел"], ["me", `Мне · ${s.kudos_received}`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setScope(k)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${scope === k ? "bg-forest text-white" : "text-muted hover:text-ink"}`}>{l}</button>
              ))}
            </div>
          </div>
          {feed.length === 0 ? <Card><Empty>Пока пусто. Станьте первым, кто скажет спасибо!</Empty></Card> : (
            <div className="grid gap-3 md:grid-cols-2">{feed.map((k) => <KudosCard key={k.id} k={k} />)}</div>
          )}
        </div>
      </section>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Обменять коины?"
        footer={<><Button variant="light" onClick={() => setConfirm(null)}>Отмена</Button><Button variant="dark" disabled={busy} onClick={redeem}>Обменять</Button></>}>
        {confirm && (
          <div className="space-y-3">
            <p className="text-[15px]"><b>{confirm.title}</b> за <b>{confirm.cost}</b> коинов.</p>
            <p className="text-sm text-muted">Останется {s.coins - confirm.cost} коинов. Заявка уйдёт в HR. Если её не одобрят, коины вернутся.</p>
            {error && <p className="rounded-2xl bg-danger-50 px-4 py-2.5 text-sm text-danger">{error}</p>}
          </div>
        )}
      </Modal>

      <Modal open={!!done} onClose={() => setDone(null)} title="Заявка отправлена"
        footer={<Button variant="dark" onClick={() => setDone(null)}>Отлично</Button>}>
        {done && <p className="text-[15px]">«{done.reward.title}» ждёт подтверждения HR. Статус появится в разделе «Мои обмены», а уведомление придёт сюда же.</p>}
      </Modal>

      {isLead && <GoalModal open={goalOpen} onClose={() => setGoalOpen(false)} onSaved={savedGoal} current={s.goal} />}
    </div>
  );
}

function Wallet({ s }: { s: MotivationSummary }) {
  const n = useCountUp(s.coins);
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-forest p-6 text-white">
      <svg className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 text-white/[0.05]" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="currentColor" />
      </svg>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-signal">Ваш баланс</p>
      <p className="mt-2 flex items-center gap-3 font-display text-[52px] font-bold leading-none tracking-[-0.04em]"><Coin size={44} /> {n}</p>
      <p className="mt-2 text-[13px] text-white/60">Jana-коинов · всего заработано {s.coins_earned}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
        <Link to="/academy" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15"><GraduationCap size={14} /> Учиться: 1 XP = 1 коин</Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Heart size={14} /> Благодарность коллеги: +15</span>
      </div>
      {s.history.length > 0 && (
        <ul className="mt-5 space-y-1.5 border-t border-white/10 pt-4">
          {s.history.slice(0, 5).map((h, i) => (
            <li key={i} className="flex items-center gap-2 text-[12.5px]">
              {h.amount > 0 ? <ArrowUpRight size={14} className="shrink-0 text-signal" /> : <ArrowDownRight size={14} className="shrink-0 text-white/50" />}
              <span className="min-w-0 flex-1 truncate text-white/75">{h.reason}</span>
              <b className={h.amount > 0 ? "text-signal" : "text-white/60"}>{h.amount > 0 ? "+" : ""}{h.amount}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


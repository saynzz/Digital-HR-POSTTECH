from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db import get_db
from app.models import (
    CoinTx, Employee, Kudos, Redemption, RedemptionStatus, Reward, Role, TeamGoal, User,
)
from app.services import gamification as game
from app.services.notifications import notify, notify_role

router = APIRouter(prefix="/motivation", tags=["motivation"])

VALUES = {
    "open": ("Открытость", "Делится знаниями и говорит честно"),
    "reliable": ("Надёжность", "На него можно положиться"),
    "result": ("Результат", "Доводит дело до конца"),
}
KUDOS_PER_WEEK = 3
XP_KUDOS_TO = 15
XP_KUDOS_FROM = 5


def _short(full: str) -> str:
    return " ".join(full.split()[:2])


def _person(e: Employee) -> dict:
    return {"id": e.id, "name": _short(e.full_name), "position": e.position, "department": e.department,
            "initials": "".join(p[0] for p in e.full_name.split()[:2])}


def _week_start() -> datetime:
    today = game.today_local()
    monday = today - timedelta(days=today.weekday())
    return datetime.combine(monday, datetime.min.time(), tzinfo=game.LOCAL_TZ)


def _kudos_left(db: Session, employee_id: int) -> int:
    sent = db.scalar(select(func.count(Kudos.id)).where(Kudos.from_employee_id == employee_id,
                                                        Kudos.created_at >= _week_start()))
    return max(KUDOS_PER_WEEK - sent, 0)


def _goal_out(db: Session, goal: TeamGoal | None, me: int | None = None) -> dict | None:
    if goal is None:
        return None
    p = game.goal_progress(db, goal)
    people = {e.id: e for e in db.scalars(select(Employee).where(Employee.department == goal.department))}
    top = sorted(p["by_employee"].items(), key=lambda x: -x[1])[:5]
    left = (goal.end_date - game.today_local()).days
    return {"id": goal.id, "department": goal.department, "title": goal.title, "reward": goal.reward,
            "target_xp": goal.target_xp, "start_date": goal.start_date.isoformat(), "end_date": goal.end_date.isoformat(),
            "days_left": max(left, 0), "achieved": goal.achieved_at is not None, "total": p["total"], "percent": p["percent"],
            "members": p["members"], "my_xp": p["by_employee"].get(me, 0) if me else 0,
            "top": [{**_person(people[k]), "xp": v} for k, v in top if k in people]}


def _kudos_out(k: Kudos, me: int) -> dict:
    title, _ = VALUES.get(k.value, (k.value, ""))
    return {"id": k.id, "from": _person(k.sender), "to": _person(k.receiver), "value": k.value, "value_title": title,
            "message": k.message, "created_at": k.created_at.isoformat(), "mine": k.to_employee_id == me,
            "sent_by_me": k.from_employee_id == me}


def _redemption_out(r: Redemption) -> dict:
    return {"id": r.id, "reward": {"id": r.reward.id, "title": r.reward.title, "icon": r.reward.icon}, "cost": r.cost,
            "status": r.status.value, "comment": r.comment, "created_at": r.created_at.isoformat(),
            "decided_at": r.decided_at.isoformat() if r.decided_at else None, "employee": _person(r.employee)}


def _reward_out(r: Reward) -> dict:
    return {"id": r.id, "title": r.title, "description": r.description, "cost": r.cost, "icon": r.icon,
            "stock": r.stock, "active": r.active}


@router.get("/summary")
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    eid = user.employee_id
    earned = int(db.scalar(select(func.coalesce(func.sum(CoinTx.amount), 0)).where(
        CoinTx.employee_id == eid, CoinTx.amount > 0, CoinTx.ref.like("xp:%"))))
    history = db.scalars(select(CoinTx).where(CoinTx.employee_id == eid).order_by(CoinTx.created_at.desc()).limit(8))
    got = db.scalar(select(func.count(Kudos.id)).where(Kudos.to_employee_id == eid))
    return {
        "coins": game.coins(db, eid), "coins_earned": earned, "kudos_left": _kudos_left(db, eid),
        "kudos_per_week": KUDOS_PER_WEEK, "kudos_received": got,
        "values": [{"code": k, "title": t, "hint": h} for k, (t, h) in VALUES.items()],
        "goal": _goal_out(db, game.active_goal(db, user.employee.department), eid),
        "history": [{"amount": c.amount, "reason": c.reason, "at": c.created_at.isoformat()} for c in history],
    }


@router.get("/rewards")
def rewards(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [_reward_out(r) for r in db.scalars(select(Reward).where(Reward.active.is_(True)).order_by(Reward.cost))]


@router.post("/rewards/{reward_id}/redeem", status_code=201)
def redeem(reward_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reward = db.get(Reward, reward_id)
    if reward is None or not reward.active:
        raise HTTPException(404, "Награда не найдена")
    if reward.stock is not None and reward.stock <= 0:
        raise HTTPException(400, "Награда закончилась")
    balance = game.coins(db, user.employee_id)
    if balance < reward.cost:
        raise HTTPException(400, f"Не хватает коинов: нужно {reward.cost}, у вас {balance}")
    r = Redemption(employee_id=user.employee_id, reward_id=reward.id, cost=reward.cost)
    db.add(r)
    db.flush()
    db.add(CoinTx(employee_id=user.employee_id, amount=-reward.cost, reason=f"Обмен: {reward.title}", ref=f"redeem:{r.id}"))
    if reward.stock is not None:
        reward.stock -= 1
    notify_role(db, Role.hr, "system", f"Обмен коинов: {reward.title}", f"{user.employee.full_name}, {reward.cost} коинов",
                "/hr?tab=rewards")
    db.commit()
    db.refresh(r)
    return _redemption_out(r)


@router.get("/redemptions/my")
def my_redemptions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Redemption).where(Redemption.employee_id == user.employee_id)
                      .order_by(Redemption.created_at.desc()))
    return [_redemption_out(r) for r in rows]


def _refund(db: Session, r: Redemption, reason: str) -> None:
    db.add(CoinTx(employee_id=r.employee_id, amount=r.cost, reason=reason, ref=f"refund:{r.id}"))
    if r.reward.stock is not None:
        r.reward.stock += 1


@router.post("/redemptions/{rid}/cancel")
def cancel_redemption(rid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.get(Redemption, rid)
    if r is None or r.employee_id != user.employee_id:
        raise HTTPException(404, "Не найдено")
    if r.status != RedemptionStatus.pending:
        raise HTTPException(400, "Обмен уже обработан")
    r.status = RedemptionStatus.cancelled
    _refund(db, r, f"Возврат: {r.reward.title}")
    db.commit()
    return _redemption_out(r)


class DecideIn(BaseModel):
    approve: bool
    comment: str | None = Field(default=None, max_length=500)


@router.get("/admin/redemptions")
def admin_redemptions(user: User = Depends(require_roles(Role.hr)), db: Session = Depends(get_db)):
    rows = db.scalars(select(Redemption).order_by(Redemption.status != RedemptionStatus.pending,
                                                  Redemption.created_at.desc()).limit(50))
    return [_redemption_out(r) for r in rows]


@router.post("/admin/redemptions/{rid}/decide")
def decide(rid: int, data: DecideIn, user: User = Depends(require_roles(Role.hr)), db: Session = Depends(get_db)):
    r = db.get(Redemption, rid)
    if r is None:
        raise HTTPException(404, "Не найдено")
    if r.status != RedemptionStatus.pending:
        raise HTTPException(400, "Обмен уже обработан")
    r.status = RedemptionStatus.approved if data.approve else RedemptionStatus.rejected
    r.comment, r.decided_by_user_id, r.decided_at = data.comment, user.id, datetime.now(timezone.utc)
    if not data.approve:
        _refund(db, r, f"Возврат: {r.reward.title}")
    target = db.scalar(select(User).where(User.employee_id == r.employee_id))
    if target:
        notify(db, target.id, "system",
               f"Награда {'одобрена' if data.approve else 'не одобрена'}: {r.reward.title}",
               data.comment or ("HR свяжется с вами, чтобы вручить награду" if data.approve else "Коины возвращены"),
               "/rewards")
    db.commit()
    return _redemption_out(r)


class RewardIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(default="", max_length=1000)
    cost: int = Field(ge=1, le=100000)
    icon: str = "gift"
    stock: int | None = Field(default=None, ge=0)
    active: bool = True


@router.get("/admin/rewards")
def admin_rewards(user: User = Depends(require_roles(Role.hr)), db: Session = Depends(get_db)):
    return [_reward_out(r) for r in db.scalars(select(Reward).order_by(Reward.active.desc(), Reward.cost))]


@router.post("/admin/rewards", status_code=201)
def create_reward(data: RewardIn, user: User = Depends(require_roles(Role.hr)), db: Session = Depends(get_db)):
    r = Reward(**data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _reward_out(r)


@router.put("/admin/rewards/{reward_id}")
def update_reward(reward_id: int, data: RewardIn, user: User = Depends(require_roles(Role.hr)),
                  db: Session = Depends(get_db)):
    r = db.get(Reward, reward_id)
    if r is None:
        raise HTTPException(404, "Награда не найдена")
    for k, v in data.model_dump().items():
        setattr(r, k, v)
    db.commit()
    return _reward_out(r)


class KudosIn(BaseModel):
    to_employee_id: int
    value: Literal["open", "reliable", "result"]
    message: str = Field(min_length=3, max_length=300)


@router.get("/colleagues")
def colleagues(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Employee).where(Employee.id != user.employee_id).order_by(Employee.full_name))
    mine = user.employee.department
    return sorted([_person(e) for e in rows], key=lambda p: (p["department"] != mine, p["name"]))


@router.post("/kudos", status_code=201)
def send_kudos(data: KudosIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.to_employee_id == user.employee_id:
        raise HTTPException(400, "Себя поблагодарить нельзя")
    to = db.get(Employee, data.to_employee_id)
    if to is None:
        raise HTTPException(404, "Сотрудник не найден")
    if _kudos_left(db, user.employee_id) <= 0:
        raise HTTPException(400, f"Лимит: {KUDOS_PER_WEEK} благодарности в неделю. Новые — с понедельника")
    k = Kudos(from_employee_id=user.employee_id, to_employee_id=to.id, value=data.value, message=data.message.strip())
    db.add(k)
    db.flush()
    sender_rw, receiver_rw = game.Rewards(), game.Rewards()
    xp_from, xp_to = game.total_xp(db, user.employee_id), game.total_xp(db, to.id)
    game._give(db, receiver_rw, to.id, "kudos", f"kudos:{k.id}:to", XP_KUDOS_TO,
               f"Благодарность от {_short(user.employee.full_name)}")
    game._give(db, sender_rw, user.employee_id, "kudos_sent", f"kudos:{k.id}:from", XP_KUDOS_FROM,
               f"Благодарность коллеге: {_short(to.full_name)}")
    game._finish(db, receiver_rw, to.id, xp_to)
    game._finish(db, sender_rw, user.employee_id, xp_from)
    target = db.scalar(select(User).where(User.employee_id == to.id))
    if target:
        notify(db, target.id, "system", f"Вас поблагодарил(а) {_short(user.employee.full_name)}",
               f"«{k.message}» · {VALUES[data.value][0]} · +{XP_KUDOS_TO} XP", "/rewards")
    db.commit()
    db.refresh(k)
    return {"kudos": _kudos_out(k, user.employee_id), "rewards": sender_rw.as_dict(), "kudos_left": _kudos_left(db, user.employee_id)}


@router.get("/kudos")
def kudos_feed(scope: Literal["all", "me", "team"] = "all", user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    q = select(Kudos).order_by(Kudos.created_at.desc()).limit(30)
    if scope == "me":
        q = q.where(Kudos.to_employee_id == user.employee_id)
    elif scope == "team":
        ids = select(Employee.id).where(Employee.department == user.employee.department)
        q = q.where(Kudos.to_employee_id.in_(ids))
    return [_kudos_out(k, user.employee_id) for k in db.scalars(q)]


class GoalIn(BaseModel):
    department: str | None = None
    title: str = Field(min_length=3, max_length=255)
    reward: str = Field(min_length=3, max_length=255)
    target_xp: int = Field(ge=50, le=100000)
    end_date: date


@router.get("/goals")
def goals(user: User = Depends(require_roles(Role.manager, Role.hr)), db: Session = Depends(get_db)):
    deps = sorted(set(db.scalars(select(Employee.department)))) if user.role == Role.hr else [user.employee.department]
    return [{"department": d, "goal": _goal_out(db, game.active_goal(db, d))} for d in deps]


@router.post("/goals", status_code=201)
def set_goal(data: GoalIn, user: User = Depends(require_roles(Role.manager, Role.hr)), db: Session = Depends(get_db)):
    dept = data.department if user.role == Role.hr and data.department else user.employee.department
    today = game.today_local()
    if data.end_date <= today:
        raise HTTPException(400, "Дата окончания должна быть в будущем")
    old = game.active_goal(db, dept)
    if old:
        old.end_date = today - timedelta(days=1)
    g = TeamGoal(department=dept, title=data.title, reward=data.reward, target_xp=data.target_xp, start_date=today,
                 end_date=data.end_date, created_by_user_id=user.id)
    db.add(g)
    db.flush()
    for u in db.scalars(select(User).join(Employee, User.employee_id == Employee.id).where(Employee.department == dept)):
        if u.id != user.id:
            notify(db, u.id, "system", f"Новая цель отдела: {g.title}",
                   f"{g.target_xp} XP до {g.end_date.strftime('%d.%m.%Y')} · награда: {g.reward}", "/rewards")
    db.commit()
    return _goal_out(db, g)

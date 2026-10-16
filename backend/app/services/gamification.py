from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    EarnedBadge, Employee, Enrollment, EnrollmentStatus, Lesson, Track, TrackEnrollment, User, XpEvent,
)
from app.services.notifications import notify

LOCAL_TZ = timezone(timedelta(hours=5))

XP_LESSON = 10
XP_QUIZ = 50
XP_PERFECT = 25
XP_FIRST_TRY = 15
XP_EARLY = 20
XP_STREAK = 5

LEVELS = [
    (0, "Стажёр"),
    (100, "Курьер"),
    (250, "Экспедитор"),
    (500, "Логист"),
    (900, "Мастер маршрута"),
    (1500, "Легенда Jana Post"),
]

BADGES = [
    ("first_step", "Первый шаг", "Пройти первый урок", "footprints"),
    ("first_course", "Первая посылка", "Пройти первый курс", "package"),
    ("perfect", "Точно в цель", "Сдать тест на 100%", "target"),
    ("first_try", "С первой попытки", "Сдать тест с первой попытки", "zap"),
    ("early", "Раньше срока", "Пройти курс до дедлайна", "clock"),
    ("streak3", "Разгон", "Заниматься 3 дня подряд", "flame"),
    ("streak7", "Неделя без пропусков", "Заниматься 7 дней подряд", "calendar"),
    ("track", "Маршрут пройден", "Завершить траекторию обучения", "route"),
    ("courses5", "Книжный червь", "Пройти 5 курсов", "books"),
    ("level4", "Логист", "Достичь 4-го уровня", "trophy"),
]
BADGE_INFO = {code: (title, desc, icon) for code, title, desc, icon in BADGES}


def today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


def to_local(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ).date()


def level_info(xp: int) -> dict:
    n = max(i for i, (need, _) in enumerate(LEVELS) if xp >= need)
    cur, title = LEVELS[n]
    nxt = LEVELS[n + 1][0] if n + 1 < len(LEVELS) else None
    return {"level": n + 1, "title": title, "xp_from": cur, "xp_to": nxt,
            "next_title": LEVELS[n + 1][1] if nxt is not None else None,
            "progress": 100 if nxt is None else round(100 * (xp - cur) / (nxt - cur))}


def total_xp(db: Session, employee_id: int, since: datetime | None = None) -> int:
    q = select(func.coalesce(func.sum(XpEvent.xp), 0)).where(XpEvent.employee_id == employee_id)
    if since:
        q = q.where(XpEvent.created_at >= since)
    return int(db.scalar(q))


def active_days(db: Session, employee_id: int) -> set[date]:
    rows = db.scalars(select(XpEvent.created_at).where(XpEvent.employee_id == employee_id))
    return {to_local(d) for d in rows}


def streak_info(days: set[date], today: date | None = None) -> dict:
    today = today or today_local()
    anchor = today if today in days else today - timedelta(days=1)
    cur = 0
    d = anchor
    while d in days:
        cur += 1
        d -= timedelta(days=1)
    best, run, prev = 0, 0, None
    for d in sorted(days):
        run = run + 1 if prev and (d - prev).days == 1 else 1
        best = max(best, run)
        prev = d
    return {"current": cur, "best": max(best, cur), "today": today in days,
            "days": [{"date": (today - timedelta(days=i)).isoformat(), "active": (today - timedelta(days=i)) in days}
                     for i in range(13, -1, -1)]}


@dataclass
class Rewards:
    xp: int = 0
    items: list[dict] = field(default_factory=list)
    badges: list[dict] = field(default_factory=list)
    level_up: dict | None = None
    tracks: list[str] = field(default_factory=list)

    def as_dict(self) -> dict | None:
        if not (self.xp or self.badges):
            return None
        return {"xp": self.xp, "items": self.items, "badges": self.badges, "level_up": self.level_up, "tracks": self.tracks}


def _has(db: Session, employee_id: int, ref: str) -> bool:
    return db.scalar(select(XpEvent.id).where(XpEvent.employee_id == employee_id, XpEvent.ref == ref)) is not None


def _give(db: Session, r: Rewards, employee_id: int, kind: str, ref: str, xp: int, title: str,
          at: datetime | None = None) -> None:
    if _has(db, employee_id, ref):
        return
    db.add(XpEvent(employee_id=employee_id, kind=kind, ref=ref, xp=xp, title=title, **({"created_at": at} if at else {})))
    db.flush()
    r.xp += xp
    r.items.append({"label": title, "xp": xp})


def _streak_bonus(db: Session, r: Rewards, employee_id: int) -> None:
    today = today_local()
    days = active_days(db, employee_id)
    st = streak_info(days, today)
    if st["current"] >= 2 and not _has(db, employee_id, f"streak:{today.isoformat()}"):
        bonus = XP_STREAK * min(st["current"], 7)
        _give(db, r, employee_id, "streak", f"streak:{today.isoformat()}", bonus,
              f"Серия {st['current']} {_days(st['current'])} подряд")


def _days(n: int) -> str:
    n100, n10 = n % 100, n % 10
    return "дней" if 11 <= n100 <= 14 else "день" if n10 == 1 else "дня" if 2 <= n10 <= 4 else "дней"


def evaluate_badges(db: Session, employee_id: int, at: datetime | None = None) -> list[dict]:
    have = set(db.scalars(select(EarnedBadge.code).where(EarnedBadge.employee_id == employee_id)))
    enrolls = list(db.scalars(select(Enrollment).where(Enrollment.employee_id == employee_id)))
    done = [e for e in enrolls if e.status == EnrollmentStatus.completed]
    days = active_days(db, employee_id)
    st = streak_info(days)
    xp = total_xp(db, employee_id)
    track_done = db.scalar(select(TrackEnrollment.id).where(
        TrackEnrollment.employee_id == employee_id, TrackEnrollment.completed_at.is_not(None))) is not None
    rules = {
        "first_step": any(e.completed_lesson_ids for e in enrolls),
        "first_course": bool(done),
        "perfect": any(e.score == 100 for e in done),
        "first_try": any(e.attempts == 1 for e in done),
        "early": any(e.due_date and e.completed_at and to_local(e.completed_at) <= e.due_date for e in done),
        "streak3": st["best"] >= 3,
        "streak7": st["best"] >= 7,
        "track": track_done,
        "courses5": len(done) >= 5,
        "level4": xp >= LEVELS[3][0],
    }
    new = []
    for code, ok in rules.items():
        if ok and code not in have:
            db.add(EarnedBadge(employee_id=employee_id, code=code, **({"earned_at": at} if at else {})))
            title, desc, icon = BADGE_INFO[code]
            new.append({"code": code, "title": title, "description": desc, "icon": icon})
    db.flush()
    return new


def _finish(db: Session, r: Rewards, employee_id: int, xp_before: int) -> Rewards:
    for t in check_tracks(db, employee_id, r):
        r.tracks.append(t)
    r.badges = evaluate_badges(db, employee_id)
    before, after = level_info(xp_before), level_info(xp_before + r.xp)
    if after["level"] > before["level"]:
        r.level_up = {"level": after["level"], "title": after["title"]}
    user = db.scalar(select(User).where(User.employee_id == employee_id))
    if user:
        for b in r.badges:
            notify(db, user.id, "system", f"Новый бейдж: {b['title']}", b["description"], "/academy")
        if r.level_up:
            notify(db, user.id, "system", f"Новый уровень: {r.level_up['title']}",
                   f"Уровень {r.level_up['level']} в Jana Academy", "/academy")
    return r


def on_lesson(db: Session, enr: Enrollment, lesson: Lesson) -> Rewards:
    r = Rewards()
    before = total_xp(db, enr.employee_id)
    _give(db, r, enr.employee_id, "lesson", f"lesson:{lesson.id}", XP_LESSON, f"Урок «{lesson.title}»")
    if r.xp:
        _streak_bonus(db, r, enr.employee_id)
    return _finish(db, r, enr.employee_id, before)


def on_quiz(db: Session, enr: Enrollment) -> Rewards:
    r = Rewards()
    before = total_xp(db, enr.employee_id)
    if enr.status == EnrollmentStatus.completed:
        c = enr.course
        _give(db, r, enr.employee_id, "course", f"course:{c.id}", XP_QUIZ, f"Курс «{c.title}» пройден")
        if enr.score == 100:
            _give(db, r, enr.employee_id, "perfect", f"perfect:{c.id}", XP_PERFECT, "Тест на 100%")
        if enr.attempts == 1:
            _give(db, r, enr.employee_id, "first_try", f"first_try:{c.id}", XP_FIRST_TRY, "С первой попытки")
        if enr.due_date and enr.due_date >= today_local():
            _give(db, r, enr.employee_id, "early", f"early:{c.id}", XP_EARLY, "Раньше срока")
        _streak_bonus(db, r, enr.employee_id)
    return _finish(db, r, enr.employee_id, before)


def track_progress(track: Track, by_course: dict[int, Enrollment]) -> dict:
    required = [s for s in track.steps if s.required]
    done_req = [s for s in required if by_course.get(s.course_id) and by_course[s.course_id].status == EnrollmentStatus.completed]
    all_done = [s for s in track.steps if by_course.get(s.course_id) and by_course[s.course_id].status == EnrollmentStatus.completed]
    pct = round(100 * sum(by_course[s.course_id].progress if by_course.get(s.course_id) else 0 for s in required)
                / (100 * len(required))) if required else 0
    return {"required": len(required), "required_done": len(done_req), "done": len(all_done), "total": len(track.steps),
            "progress": pct, "complete": bool(required) and len(done_req) == len(required)}


def check_tracks(db: Session, employee_id: int, r: Rewards | None = None) -> list[str]:
    finished = []
    tes = db.scalars(select(TrackEnrollment).where(TrackEnrollment.employee_id == employee_id,
                                                   TrackEnrollment.completed_at.is_(None))).all()
    if not tes:
        return finished
    by_course = {e.course_id: e for e in db.scalars(select(Enrollment).where(Enrollment.employee_id == employee_id))}
    for te in tes:
        if track_progress(te.track, by_course)["complete"]:
            te.completed_at = datetime.now(timezone.utc)
            if r is not None:
                _give(db, r, employee_id, "track", f"track:{te.track_id}", te.track.xp_reward,
                      f"Траектория «{te.track.title}» завершена")
            finished.append(te.track.title)
    db.flush()
    return finished


def enroll_track(db: Session, employee: Employee, track: Track, actor: User | None, due: date | None) -> TrackEnrollment:
    te = db.scalar(select(TrackEnrollment).where(TrackEnrollment.employee_id == employee.id,
                                                 TrackEnrollment.track_id == track.id))
    if te is None:
        te = TrackEnrollment(employee_id=employee.id, track_id=track.id, due_date=due,
                             assigned_by_user_id=actor.id if actor else None)
        db.add(te)
    elif due:
        te.due_date = due
    existing = {e.course_id: e for e in db.scalars(select(Enrollment).where(Enrollment.employee_id == employee.id))}
    for s in track.steps:
        if s.course_id not in existing:
            db.add(Enrollment(employee_id=employee.id, course_id=s.course_id,
                              assigned_by_user_id=actor.id if actor else None, due_date=due if s.required else None))
    db.flush()
    return te


def remind_deadlines(db: Session, user: User) -> None:
    today = today_local()
    soon = db.scalars(select(Enrollment).where(
        Enrollment.employee_id == user.employee_id, Enrollment.status != EnrollmentStatus.completed,
        Enrollment.due_date.is_not(None), Enrollment.reminded_at.is_(None))).all()
    changed = False
    for e in soon:
        left = (e.due_date - today).days
        if left <= 3:
            text = "срок истёк" if left < 0 else "срок сегодня" if left == 0 else f"осталось {left} {_days(left)}"
            notify(db, user.id, "course_assigned", f"Напоминание: курс «{e.course.title}»", text, f"/academy/{e.course_id}")
            e.reminded_at = datetime.now(timezone.utc)
            changed = True
    if changed:
        db.commit()


def leaderboard(db: Session, employees: list[Employee], since: datetime | None, me: int) -> list[dict]:
    ids = [e.id for e in employees]
    q = select(XpEvent.employee_id, func.sum(XpEvent.xp)).where(XpEvent.employee_id.in_(ids))
    if since:
        q = q.where(XpEvent.created_at >= since)
    sums = dict(db.execute(q.group_by(XpEvent.employee_id)).all())
    totals = dict(db.execute(select(XpEvent.employee_id, func.sum(XpEvent.xp)).where(XpEvent.employee_id.in_(ids))
                             .group_by(XpEvent.employee_id)).all())
    rows = []
    for e in employees:
        xp = int(sums.get(e.id) or 0)
        lvl = level_info(int(totals.get(e.id) or 0))
        rows.append({"employee_id": e.id, "name": " ".join(e.full_name.split()[:2]), "department": e.department,
                     "position": e.position, "xp": xp, "level": lvl["level"], "level_title": lvl["title"],
                     "streak": streak_info(active_days(db, e.id))["current"], "me": e.id == me})
    rows.sort(key=lambda x: (-x["xp"], x["name"]))
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return rows

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AccountStatus, Employee, Enrollment, EnrollmentStatus, HRRequest, RequestStatus, RequestType, Role, User,
)

LOCAL_TZ = timezone(timedelta(hours=5))
DAYS_PER_YEAR = 24
MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября",
          "ноября", "декабря"]
MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
PENDING = (RequestStatus.pending_manager, RequestStatus.pending_hr)


def plural(n: int, forms: tuple[str, str, str]) -> str:
    n = abs(n) % 100
    if 11 <= n <= 14:
        return forms[2]
    n %= 10
    return forms[0] if n == 1 else forms[1] if 2 <= n <= 4 else forms[2]


def days_word(n: int) -> str:
    return f"{n} {plural(n, ('день', 'дня', 'дней'))}"


def fmt_date(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def fmt_money(n: int) -> str:
    return f"{n:,}".replace(",", " ") + " ₸"


def short_name(full: str) -> str:
    return " ".join(full.split()[:2])


def local_date(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(LOCAL_TZ).date()


def months_between(a: date, b: date) -> int:
    m = (b.year - a.year) * 12 + b.month - a.month
    return m - 1 if b.day < a.day else m


def tenure_text(start: date, today: date) -> str:
    m = max(months_between(start, today), 0)
    y, m = divmod(m, 12)
    parts = []
    if y:
        parts.append(f"{y} {plural(y, ('год', 'года', 'лет'))}")
    if m or not y:
        parts.append(f"{m} мес.")
    if not y and not m:
        d = (today - start).days
        return days_word(max(d, 0))
    return " ".join(parts)


def gap_text(days: int) -> str:
    if days < 60:
        return days_word(days)
    return f"{days // 30} мес."


@dataclass
class Vacation:
    id: int
    start: date
    end: date
    days: int
    status: RequestStatus


@dataclass
class Signal:
    level: str
    code: str
    text: str
    action: str
    employee_id: int
    who: str
    cmd: str | None = None
    link: str | None = None

    def as_dict(self) -> dict:
        return {"level": self.level, "code": self.code, "text": self.text, "action": self.action,
                "who": self.who, "cmd": self.cmd, "link": self.link}


LEVEL_ORDER = {"high": 0, "medium": 1, "info": 2}


@dataclass
class Facts:
    emp: Employee
    user: User | None
    today: date
    requests: list[HRRequest]
    enrollments: list[Enrollment]
    vacations: list[Vacation] = field(default_factory=list)
    signals: list[Signal] = field(default_factory=list)

    @property
    def name(self) -> str:
        return short_name(self.emp.full_name)

    @property
    def female(self) -> bool:
        parts = self.emp.full_name.split()
        return len(parts) > 2 and (parts[2].endswith("вна") or parts[2].lower().endswith("кызы"))

    def g(self, male: str, female: str) -> str:
        return female if self.female else male

    @property
    def tenure_days(self) -> int:
        return (self.today - self.emp.hire_date).days

    @property
    def tenure(self) -> str:
        return tenure_text(self.emp.hire_date, self.today)

    @property
    def balance(self) -> int:
        return self.emp.vacation_balance_days

    @property
    def approved_vac(self) -> list[Vacation]:
        return [v for v in self.vacations if v.status == RequestStatus.approved]

    @property
    def vac_done(self) -> list[Vacation]:
        return [v for v in self.approved_vac if v.end < self.today]

    @property
    def vac_now(self) -> Vacation | None:
        return next((v for v in self.approved_vac if v.start <= self.today <= v.end), None)

    @property
    def vac_planned(self) -> list[Vacation]:
        return [v for v in self.approved_vac if v.start > self.today]

    @property
    def vac_pending(self) -> list[Vacation]:
        return [v for v in self.vacations if v.status in PENDING]

    @property
    def taken_days(self) -> int:
        return sum(v.days for v in self.vac_done) + (
            (self.today - self.vac_now.start).days + 1 if self.vac_now else 0)

    @property
    def earned_days(self) -> int:
        return round(self.tenure_days / 365 * DAYS_PER_YEAR)

    @property
    def last_vac_end(self) -> date | None:
        done = self.vac_done
        return max(v.end for v in done) if done else None

    @property
    def days_without_vac(self) -> int:
        if self.vac_now:
            return 0
        anchor = self.last_vac_end or self.emp.hire_date
        return (self.today - anchor).days

    def vac_by_year(self) -> dict[int, int]:
        out: dict[int, int] = {y: 0 for y in range(self.emp.hire_date.year, self.today.year + 1)}
        for v in self.vac_done:
            out[v.start.year] = out.get(v.start.year, 0) + v.days
        return out

    def advances(self, statuses: tuple[RequestStatus, ...] | None = (RequestStatus.approved,)) -> list[HRRequest]:
        return [r for r in self.requests if r.type == RequestType.advance and (statuses is None or r.status in statuses)]

    def advances_since(self, days: int) -> list[HRRequest]:
        border = self.today - timedelta(days=days)
        return [r for r in self.advances() if local_date(r.created_at) >= border]

    @property
    def adv_total(self) -> int:
        return sum(int(r.payload.get("amount", 0)) for r in self.advances())

    def adv_by_year(self) -> dict[int, int]:
        out: dict[int, int] = {y: 0 for y in range(self.emp.hire_date.year, self.today.year + 1)}
        for r in self.advances():
            y = local_date(r.created_at).year
            out[y] = out.get(y, 0) + int(r.payload.get("amount", 0))
        return out

    @property
    def rejected(self) -> list[HRRequest]:
        return [r for r in self.requests if r.status == RequestStatus.rejected]

    @property
    def pending(self) -> list[HRRequest]:
        return [r for r in self.requests if r.status in PENDING]

    def waiting_days(self, r: HRRequest) -> int:
        last = r.events[-1].created_at if r.events else r.created_at
        return (self.today - local_date(last)).days

    def decision_hours(self) -> list[float]:
        out = []
        for r in self.requests:
            if r.status != RequestStatus.approved or not r.events:
                continue
            done = next((e for e in r.events if e.to_status == RequestStatus.approved), None)
            if done:
                out.append((done.created_at - r.events[0].created_at).total_seconds() / 3600)
        return out

    @property
    def completed_courses(self) -> list[Enrollment]:
        return [e for e in self.enrollments if e.status == EnrollmentStatus.completed]

    @property
    def overdue_courses(self) -> list[Enrollment]:
        return [e for e in self.enrollments
                if e.status != EnrollmentStatus.completed and e.due_date and e.due_date < self.today]

    @property
    def avg_score(self) -> int | None:
        scores = [e.score for e in self.completed_courses if e.score is not None]
        return round(sum(scores) / len(scores)) if scores else None

    @property
    def account(self) -> str:
        if self.user is None:
            return "нет"
        return {AccountStatus.active: "активен", AccountStatus.invited: "ожидает активации",
                AccountStatus.blocked: "заблокирован"}[self.user.status]


def _vacations(reqs: list[HRRequest]) -> list[Vacation]:
    out = []
    for r in reqs:
        if r.type != RequestType.vacation:
            continue
        s, e = date.fromisoformat(r.payload["start_date"]), date.fromisoformat(r.payload["end_date"])
        out.append(Vacation(r.id, s, e, int(r.payload.get("days") or (e - s).days + 1), r.status))
    return sorted(out, key=lambda v: v.start)


def _signals(f: Facts) -> list[Signal]:
    out: list[Signal] = []
    cmd = f"/сотрудник {f.name}"
    add = lambda level, code, text, action, **kw: out.append(
        Signal(level, code, text, action, f.emp.id, f.name, kw.get("cmd", cmd), kw.get("link")))

    gap = f.days_without_vac
    planned = f.vac_planned or f.vac_pending
    if f.tenure_days >= 180 and not f.vac_now:
        if gap > 365 and not planned:
            add("high", "no_vacation", f"{f.g('Не был', 'Не была')} в отпуске {gap_text(gap)}",
                "Предложите запланировать отпуск: длительная работа без отдыха повышает риск выгорания")
        elif gap > 365:
            add("medium", "no_vacation", f"{f.g('Не был', 'Не была')} в отпуске {gap_text(gap)}, отпуск уже подан",
                "Проследите, чтобы запланированный отпуск не перенесли")
        elif gap > 270 and not planned:
            add("medium", "no_vacation", f"Без отпуска {gap_text(gap)}",
                "Обсудите график отпусков на ближайшие месяцы")
    if f.balance >= 28:
        add("medium", "big_balance", f"Накоплено {days_word(f.balance)} неиспользованного отпуска",
            "Согласуйте график, чтобы дни не копились: при увольнении их придётся компенсировать")
    adv6 = f.advances_since(183)
    if len(adv6) >= 3:
        add("medium", "frequent_advances",
            f"{len(adv6)} {plural(len(adv6), ('аванс', 'аванса', 'авансов'))} за полгода на {fmt_money(sum(int(r.payload['amount']) for r in adv6))}",
            "Деликатно уточните, нужна ли поддержка: консультация HR или программа помощи сотрудникам")
    for e in f.overdue_courses:
        late = (f.today - e.due_date).days
        add("medium", "overdue_course", f"Просрочен курс «{e.course.title}» на {days_word(late)}",
            "Напомните о курсе или перенесите срок", link="/academy")
    for r in f.pending:
        w = f.waiting_days(r)
        if w >= 3:
            who = "руководителя" if r.status == RequestStatus.pending_manager else "HR"
            kind = "Отпуск" if r.type == RequestType.vacation else "Аванс"
            add("high" if w >= 5 else "medium", "stale_request", f"{kind} №{r.id} ждёт решения {who} {days_word(w)}",
                "Примите решение по заявке", link=f"/requests/{r.id}", cmd=None)
    if f.tenure_days <= 90:
        if not f.completed_courses:
            add("info", "onboarding", f"Новичок: {days_word(f.tenure_days)} в компании, вводный курс не завершён",
                "Проверьте адаптацию: курс, наставник, встреча через 30/60/90 дней")
        else:
            add("info", "onboarding", f"Новичок: {days_word(f.tenure_days)} в компании",
                "Запланируйте встречу по итогам испытательного срока")
    if f.user and f.user.status == AccountStatus.invited:
        add("medium", "not_activated", f"{f.g('Не активировал', 'Не активировала')} учётную запись JanaMen",
            "Отправьте ссылку-приглашение повторно", link="/hr", cmd=None)
    out.sort(key=lambda s: LEVEL_ORDER[s.level])
    return out


def scope_employees(db: Session, user: User) -> list[Employee]:
    q = select(Employee).order_by(Employee.full_name)
    if user.role == Role.hr:
        return list(db.scalars(q))
    if user.role == Role.manager:
        return list(db.scalars(q.where(Employee.manager_id == user.employee_id)))
    return [user.employee]


def collect(db: Session, employees: list[Employee], today: date | None = None) -> list[Facts]:
    today = today or datetime.now(LOCAL_TZ).date()
    ids = [e.id for e in employees]
    if not ids:
        return []
    reqs = db.scalars(select(HRRequest).where(HRRequest.employee_id.in_(ids))
                      .options(selectinload(HRRequest.events)).order_by(HRRequest.created_at)).all()
    enrolls = db.scalars(select(Enrollment).where(Enrollment.employee_id.in_(ids))
                         .options(selectinload(Enrollment.course))).all()
    users = {u.employee_id: u for u in db.scalars(select(User).where(User.employee_id.in_(ids)))}
    out = []
    for e in employees:
        f = Facts(e, users.get(e.id), today, [r for r in reqs if r.employee_id == e.id],
                  [x for x in enrolls if x.employee_id == e.id])
        f.vacations = _vacations(f.requests)
        f.signals = _signals(f)
        out.append(f)
    return out

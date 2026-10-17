import os
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.db import Base, SessionLocal, engine
from app.models import (
    AccountStatus, Candidate, CandidateStatus, Course, Employee, Enrollment, EnrollmentStatus, HRRequest, Lesson,
    QuizQuestion, RequestEvent, RequestStatus, RequestType, Role, User,
)
from app.seed_academy import seed_academy, seed_motivation
from app.services import request_workflow as wf
from app.services.notifications import notify

DEMO_PASSWORD = os.getenv("SEED_PASSWORD", "demo123")
COMPANY = "ТОО «Jana Post» (демо)"


def _emp(ext, name, position, dept, hire, balance, manager=None):
    return Employee(external_id=ext, full_name=name, company=COMPANY, position=position, department=dept,
                    hire_date=hire, vacation_balance_days=balance, manager=manager)


def _ts(day: date, hour: int) -> datetime:
    return datetime.combine(day, time(hour), tzinfo=timezone(timedelta(hours=5)))


def _past(db, emp, type_, payload, created: date, steps, doc: str | None = None):
    first = RequestStatus.pending_manager if emp.manager_id else RequestStatus.pending_hr
    at = _ts(created, 10)
    req = HRRequest(type=type_, employee_id=emp.id, payload=payload, status=first, created_at=at, updated_at=at)
    db.add(req)
    db.flush()
    db.add(RequestEvent(request_id=req.id, from_status=None, to_status=first, actor_user_id=emp.user.id if emp.user else None,
                        comment="Заявка создана", created_at=at))
    prev = first
    for to, actor, hours, comment in steps:
        at = at + timedelta(hours=hours)
        db.add(RequestEvent(request_id=req.id, from_status=prev, to_status=to, actor_user_id=actor.id, comment=comment,
                            created_at=at))
        prev = to
    req.status = prev
    req.updated_at = at
    if prev == RequestStatus.approved:
        req.external_doc_id = doc or f"DL-{req.id:05d}"


def _history(db, today: date, u: dict, e: dict, c1: Course, c2: Course) -> None:
    def boss(emp):
        return u["manager"] if emp.manager_id == e["head_log"].id else u["manager2"] if emp.manager_id else None

    def approved(emp):
        b = boss(emp)
        steps = [(RequestStatus.pending_hr, b, 6, "Согласовано")] if b else []
        return steps + [(RequestStatus.approved, u["hr"], 20, "Проведено в 1С:ЗУП")]

    def vac(key, ago, days, steps=None):
        emp = e[key]
        start = today - timedelta(days=ago)
        end = start + timedelta(days=days - 1)
        _past(db, emp, RequestType.vacation, {"start_date": start.isoformat(), "end_date": end.isoformat(),
                                              "days": days, "comment": None},
              start - timedelta(days=21), approved(emp) if steps is None else steps)

    def adv(key, ago, amount, steps=None):
        emp = e[key]
        _past(db, emp, RequestType.advance, {"amount": amount, "comment": None}, today - timedelta(days=ago),
              approved(emp) if steps is None else steps)

    vac("alia", 470, 14)
    vac("alia", 160, 10)
    adv("alia", 400, 80000)
    adv("alia", 210, 60000)

    vac("daniyar", 560, 12)
    adv("daniyar", 150, 40000)
    adv("daniyar", 95, 50000)
    adv("daniyar", 35, 30000)
    adv("daniyar", 300, 150000, [(RequestStatus.rejected, u["manager"], 3, "Сумма превышает лимит аванса")])

    vac("nurbol", 1250, 14)
    vac("nurbol", 900, 14)
    vac("nurbol", 430, 10)
    adv("nurbol", 700, 50000)
    nurbol = e["nurbol"]
    start = today + timedelta(days=33)
    _past(db, nurbol, RequestType.vacation, {"start_date": start.isoformat(),
                                             "end_date": (start + timedelta(days=11)).isoformat(),
                                             "days": 12, "comment": "Поездка к родителям"},
          today - timedelta(days=5), [])

    vac("madina", 760, 14)
    vac("madina", 420, 14)
    adv("madina", 300, 70000)
    adv("madina", 100, 50000)

    vac("head_log", 200, 14)
    vac("head_log", 560, 14)
    vac("head_fin", 95, 21)
    vac("hr", 250, 14)
    vac("hr", 60, 7)

    done = lambda emp, course, ago, score: Enrollment(
        employee_id=emp.id, course_id=course.id, assigned_by_user_id=u["hr"].id, status=EnrollmentStatus.completed,
        progress=100, score=score, completed_lesson_ids=[l.id for l in course.lessons],
        assigned_at=_ts(today - timedelta(days=ago + 5), 9), completed_at=_ts(today - timedelta(days=ago), 15),
        due_date=today - timedelta(days=ago - 3))
    db.add_all([
        done(e["daniyar"], c1, 700, 100),
        done(e["nurbol"], c1, 820, 100),
        done(e["nurbol"], c2, 500, 100),
        done(e["madina"], c1, 1000, 80),
        done(e["alia"], c2, 300, 100),
        Enrollment(employee_id=e["anastasia"].id, course_id=c1.id, assigned_by_user_id=u["hr"].id,
                   assigned_at=_ts(today - timedelta(days=40), 9), due_date=today - timedelta(days=3)),
    ])
    db.flush()


def seed() -> None:
    import app.models

    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if db.scalar(select(User).limit(1)):
            return

        hr = _emp("ZUP-0001", "Сапарова Айгерим Маратовна", "HR-менеджер", "Отдел персонала", date(2019, 3, 1), 24)
        head_log = _emp("ZUP-0010", "Касымов Ерлан Серикович", "Руководитель отдела логистики", "Логистика",
                        date(2018, 6, 15), 30)
        alia = _emp("ZUP-0101", "Нурланова Алия Ерболовна", "Специалист по логистике", "Логистика",
                    date(2022, 9, 5), 18, head_log)
        daniyar = _emp("ZUP-0102", "Ахметов Данияр Канатович", "Оператор склада", "Логистика",
                       date(2023, 2, 20), 12, head_log)
        head_fin = _emp("ZUP-0020", "Бекенов Тимур Аскарович", "Финансовый директор", "Финансы", date(2017, 1, 10), 28)
        madina = _emp("ZUP-0201", "Жумабаева Мадина Нурлановна", "Бухгалтер", "Финансы", date(2021, 11, 1), 21, head_fin)
        db.add_all([hr, head_log, alia, daniyar, head_fin, madina])
        db.flush()
        nurbol = _emp("ZUP-0103", "Сейткали Нурбол Ерикович", "Водитель-экспедитор", "Логистика",
                      date(2020, 4, 13), 41, head_log)
        anastasia = _emp("ZUP-0104", "Ли Анастасия Олеговна", "Координатор доставки", "Логистика",
                         date.today() - timedelta(days=40), 2, head_log)
        db.add_all([nurbol, anastasia])
        db.flush()

        pw = hash_password(DEMO_PASSWORD)
        users = {
            "hr": User(email="hr@jana.demo", password_hash=pw, role=Role.hr, employee=hr),
            "manager": User(email="manager@jana.demo", password_hash=pw, role=Role.manager, employee=head_log),
            "employee": User(email="employee@jana.demo", password_hash=pw, role=Role.employee, employee=alia),
            "employee2": User(email="employee2@jana.demo", password_hash=pw, role=Role.employee, employee=daniyar),
            "manager2": User(email="finance@jana.demo", password_hash=pw, role=Role.manager, employee=head_fin),
            "employee3": User(email="madina@jana.demo", password_hash=pw, role=Role.employee, employee=madina),
        }
        db.add_all(users.values())
        db.add(User(email="anastasia.li@jana.demo", password_hash=None, role=Role.employee,
                    status=AccountStatus.invited, employee=anastasia))
        db.commit()

        today = date.today()
        u = {k: db.scalar(select(User).where(User.email == v.email)) for k, v in users.items()}

        r1 = wf.create_request(db, u["employee"], RequestType.vacation, {
            "start_date": (today + timedelta(days=30)).isoformat(),
            "end_date": (today + timedelta(days=36)).isoformat(), "comment": "Семейная поездка"})
        wf.decide(db, u["manager"], r1, True, "Согласовано")
        wf.decide(db, u["hr"], r1, True, None)

        wf.create_request(db, u["employee"], RequestType.advance, {"amount": 100000, "comment": None})

        r3 = wf.create_request(db, u["employee2"], RequestType.vacation, {
            "start_date": (today + timedelta(days=14)).isoformat(),
            "end_date": (today + timedelta(days=17)).isoformat(), "comment": None})
        wf.decide(db, u["manager"], r3, True, None)

        r4 = wf.create_request(db, u["employee3"], RequestType.advance, {"amount": 50000, "comment": None})
        wf.decide(db, u["manager2"], r4, False, "Аванс уже выплачивался в этом месяце")

        c1 = Course(title="Добро пожаловать в Jana Post", duration_min=15, pass_score=60,
                    description="Миссия, ценности и устройство компании для новых сотрудников.")
        c1.lessons = [
            Lesson(order=1, title="Кто мы", content=(
                "Jana Post — технологическая и логистическая платформа для трансграничной торговли "
                "между Китаем и странами Центральной Азии.")),
            Lesson(order=2, title="Наши ценности", content="**Открытость. Надёжность. Результат.**"),
            Lesson(order=3, title="Куда обращаться", content=(
                "Кадровые вопросы — через Jana Hub: заявки, AI Jana и центр уведомлений.")),
        ]
        c1.questions = [
            QuizQuestion(question="Какая из ценностей Jana Post?", options=["Скорость", "Надёжность", "Экономия"],
                         correct_index=1),
            QuizQuestion(question="Где оформить заявку на отпуск?", options=["По почте", "В Jana Hub", "Устно"],
                         correct_index=1),
        ]
        c2 = Course(title="Охрана труда на складе", duration_min=20, pass_score=70,
                    description="Базовые правила безопасности при работе на складе и сортировке.")
        c2.lessons = [
            Lesson(order=1, title="Средства защиты", content="На складе обязательны жилет и защитная обувь."),
            Lesson(order=2, title="Подъём грузов", content="Груз тяжелее 20 кг поднимают вдвоём или техникой."),
        ]
        c2.questions = [
            QuizQuestion(question="Груз какого веса поднимают вдвоём?", options=["От 5 кг", "От 20 кг", "От 50 кг"],
                         correct_index=1),
        ]
        db.add_all([c1, c2])
        db.flush()
        db.add_all([
            Enrollment(employee_id=alia.id, course_id=c1.id, assigned_by_user_id=u["hr"].id,
                       due_date=today + timedelta(days=7)),
            Enrollment(employee_id=daniyar.id, course_id=c2.id, assigned_by_user_id=u["manager"].id,
                       due_date=today + timedelta(days=10)),
        ])
        _history(db, today, u, {"alia": alia, "daniyar": daniyar, "nurbol": nurbol, "anastasia": anastasia,
                                "madina": madina, "head_log": head_log, "head_fin": head_fin, "hr": hr}, c1, c2)
        seed_academy(db, today, u, {"alia": alia, "daniyar": daniyar, "nurbol": nurbol, "anastasia": anastasia,
                                    "madina": madina, "head_log": head_log, "head_fin": head_fin, "hr": hr}, c1, c2)
        seed_motivation(db, today, u, {"alia": alia, "daniyar": daniyar, "nurbol": nurbol, "anastasia": anastasia,
                                       "madina": madina, "head_log": head_log, "head_fin": head_fin, "hr": hr})
        notify(db, u["employee"].id, "course_assigned", f"Назначен курс: {c1.title}", None, f"/academy/{c1.id}")
        notify(db, u["employee2"].id, "course_assigned", f"Назначен курс: {c2.title}", None, f"/academy/{c2.id}")

        def at(days: int, hour: int) -> datetime:
            return datetime.combine(today + timedelta(days=days), time(hour), tzinfo=timezone(timedelta(hours=5)))

        db.add_all([
            Candidate(full_name="Серикбаев Арман Ержанович", email="arman.s@jana.demo", phone="+7 700 000 00 01",
                      position="Оператор сортировочного центра", department="Логистика", manager_id=head_log.id,
                      interview_at=at(1, 11), planned_start_date=today + timedelta(days=14),
                      notes="Опыт работы на складе 2 года. Готов к сменному графику.",
                      created_by_user_id=u["hr"].id),
            Candidate(full_name="Оспанова Дана Болатовна", email="dana.o@jana.demo", phone="+7 700 000 00 02",
                      position="Специалист по логистике", department="Логистика", manager_id=head_log.id,
                      interview_at=at(-1, 15), planned_start_date=today + timedelta(days=7),
                      notes="Знание ВЭД, английский B2.", status=CandidateStatus.interview_passed,
                      status_comment="Рекомендована руководителем отдела", created_by_user_id=u["hr"].id),
            Candidate(full_name="Ким Руслан Викторович", email="ruslan.k@jana.demo", phone="+7 700 000 00 03",
                      position="Бухгалтер", department="Финансы", manager_id=head_fin.id,
                      interview_at=at(-3, 10), status=CandidateStatus.interview_failed,
                      status_comment="Недостаточно опыта работы с 1С", created_by_user_id=u["hr"].id),
        ])
        db.commit()
        print("Seed: тестовые данные созданы")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

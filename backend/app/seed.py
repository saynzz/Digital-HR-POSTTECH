import os
from datetime import date, timedelta

from sqlalchemy import select

from app.core.security import hash_password
from app.db import Base, SessionLocal, engine
from app.models import Course, Employee, Enrollment, Lesson, QuizQuestion, RequestType, Role, User
from app.services import request_workflow as wf
from app.services.notifications import notify

DEMO_PASSWORD = os.getenv("SEED_PASSWORD", "demo123")
COMPANY = "ТОО «Jana Post» (демо)"


def _emp(ext, name, position, dept, hire, balance, manager=None):
    return Employee(external_id=ext, full_name=name, company=COMPANY, position=position, department=dept,
                    hire_date=hire, vacation_balance_days=balance, manager=manager)


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
                "Кадровые вопросы — через JanaMen: заявки, AI Jana и центр уведомлений.")),
        ]
        c1.questions = [
            QuizQuestion(question="Какая из ценностей Jana Post?", options=["Скорость", "Надёжность", "Экономия"],
                         correct_index=1),
            QuizQuestion(question="Где оформить заявку на отпуск?", options=["По почте", "В JanaMen", "Устно"],
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
        notify(db, u["employee"].id, "course_assigned", f"Назначен курс: {c1.title}", None, f"/academy/{c1.id}")
        notify(db, u["employee2"].id, "course_assigned", f"Назначен курс: {c2.title}", None, f"/academy/{c2.id}")
        db.commit()
        print("Seed: тестовые данные созданы")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

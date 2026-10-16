from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Course, Enrollment, EnrollmentStatus, Lesson, QuizQuestion, Track, TrackCourse, TrackEnrollment, User, XpEvent
from app.services import gamification as game

TZ = timezone(timedelta(hours=5))


def _ts(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=TZ)


def _course(title, minutes, pass_score, description, lessons, questions) -> Course:
    c = Course(title=title, duration_min=minutes, pass_score=pass_score, description=description)
    c.lessons = [Lesson(order=i, title=t, content=body) for i, (t, body) in enumerate(lessons, 1)]
    c.questions = [QuizQuestion(question=q, options=opts, correct_index=ok) for q, opts, ok in questions]
    return c


def build_courses() -> dict[str, Course]:
    return {
        "requests": _course(
            "HR-заявки в JanaMen", 10, 60, "Как за две минуты оформить отпуск или аванс и следить за статусом.",
            [("Отпуск и аванс онлайн",
              "Бумажные заявления больше не нужны. Откройте **Мои заявки → Новая заявка** и выберите тип.\n\n"
              "- **Отпуск**: укажите даты, система сама посчитает дни и проверит остаток в 1С:ЗУП.\n"
              "- **Аванс**: укажите сумму и при желании комментарий.\n\n"
              "Заявка уходит по маршруту, как посылка Jana Post."),
             ("Маршрут заявки",
              "Каждая заявка проходит этапы: **Вы → Руководитель → HR → 1С:ЗУП**.\n\n"
              "- Руководитель согласует или отклоняет с комментарием.\n"
              "- HR проводит документ в 1С:ЗУП и регистрирует его в Documentolog.\n\n"
              "На каждом шаге приходит уведомление, а история видна в карточке заявки."),
             ("AI Jana и уведомления",
              "AI Jana отвечает на кадровые вопросы **только по базе знаний** и показывает источник.\n\n"
              "Если ответа в базе нет, она честно об этом скажет и предложит передать вопрос в HR.")],
            [("Кто первым согласует заявку на отпуск?", ["HR", "Непосредственный руководитель", "Бухгалтерия"], 1),
             ("Где смотреть статус заявки?", ["В JanaMen", "Звонить в HR каждый день", "В почте руководителя"], 0),
             ("Что делает AI Jana, если ответа нет в базе знаний?",
              ["Придумывает ответ", "Предлагает передать вопрос в HR", "Ничего не отвечает"], 1)]),
        "security": _course(
            "Информационная безопасность", 15, 70, "Пароли, фишинг и защита данных клиентов и коллег.",
            [("Пароли и доступы",
              "Пароль — это ваша подпись в системах компании.\n\n"
              "- Не короче 8 символов, буквы и цифры.\n"
              "- **Никому не передавайте**, даже руководителю или ИТ.\n"
              "- Блокируйте компьютер, когда отходите: Win+L или Ctrl+Cmd+Q."),
             ("Фишинг",
              "Мошенники пишут от имени банка, руководителя или службы доставки и просят срочно перейти по ссылке.\n\n"
              "- Проверяйте адрес отправителя.\n"
              "- Не вводите пароль на страницах из писем.\n"
              "- Сомневаетесь — **сообщите в службу ИБ** и не переходите по ссылке."),
             ("Персональные данные",
              "Данные клиентов и сотрудников храним **только в корпоративных системах**.\n\n"
              "Нельзя пересылать их в личные мессенджеры, на личную почту или копировать на флешки.")],
            [("Письмо просит срочно ввести пароль по ссылке. Что делать?",
              ["Ввести, раз срочно", "Не переходить и сообщить в ИБ", "Переслать коллегам"], 1),
             ("Можно ли передать коллеге свой пароль?", ["Да, если срочно", "Нет, никогда", "Только руководителю"], 1),
             ("Где хранить персональные данные клиентов?",
              ["В личной почте", "Только в корпоративных системах", "На флешке"], 1)]),
        "crossborder": _course(
            "Трансграничная доставка: основы", 20, 70, "Как посылка едет из Китая в Центральную Азию и где её ждут риски.",
            [("Маршрут посылки",
              "Типичный путь: **склад консолидации в Китае → граница → сортировочный центр → курьер или ПВЗ**.\n\n"
              "На каждом этапе посылка получает статус, который видит клиент."),
             ("Таможенное оформление",
              "Для выпуска нужны корректные данные получателя и описание вложения.\n\n"
              "- Неполный адрес или ИИН — частая причина задержки.\n"
              "- Запрещённые к ввозу товары возвращаются отправителю."),
             ("Статусы и трекинг",
              "Клиент должен видеть понятный статус. Если посылка задерживается больше чем на сутки, "
              "**сообщите клиенту заранее**, не дожидаясь жалобы.")],
            [("Частая причина задержки на таможне?", ["Цвет упаковки", "Неполные данные получателя", "Вес меньше 1 кг"], 1),
             ("Посылка задерживается больше суток. Что делать?",
              ["Ждать жалобы", "Заранее сообщить клиенту", "Отменить заказ"], 1),
             ("Что происходит с запрещённым вложением?", ["Выдаётся клиенту", "Возвращается отправителю", "Теряется"], 1)]),
        "service": _course(
            "Сервис для клиента", 15, 60, "Стандарт общения Jana Post и работа со сложными ситуациями.",
            [("Стандарт общения",
              "Мы на «вы», представляемся и называем следующий шаг: **что сделаем и когда**.\n\n"
              "Обещаем только то, что можем выполнить."),
             ("Сложный клиент",
              "Сначала выслушайте до конца, затем признайте проблему и предложите решение.\n\n"
              "- Не спорьте и не перекладывайте вину.\n"
              "- Если решение не в ваших силах, передайте старшему и предупредите клиента.")],
            [("Что важно назвать клиенту в конце разговора?", ["Свою зарплату", "Следующий шаг и срок", "Номер склада"], 1),
             ("Клиент раздражён. С чего начать?", ["Выслушать до конца", "Объяснить, что он не прав", "Положить трубку"], 0)]),
        "feedback": _course(
            "Обратная связь сотруднику", 15, 70, "Как хвалить и разбирать ошибки так, чтобы человек рос.",
            [("Модель SBI",
              "**Ситуация → Поведение → Влияние.** Говорите о конкретном случае и действии, а не о личности.\n\n"
              "Пример: «Вчера на смене (S) ты перепроверил накладные (B), и мы не отправили ни одной посылки с ошибкой (I)»."),
             ("Встречи 1:1",
              "Раз в две недели по 30 минут: самочувствие, задачи, развитие.\n\n"
              "- Слушайте больше, чем говорите.\n"
              "- Фиксируйте договорённости.\n"
              "- Следите за отпусками: долгая работа без отдыха — риск выгорания.")],
            [("Что значит буква B в модели SBI?", ["Бюджет", "Поведение", "Бонус"], 1),
             ("Как часто проводить встречи 1:1?", ["Раз в год", "Раз в две недели", "Только при проблемах"], 1)]),
        "approvals": _course(
            "Согласование заявок команды", 10, 60, "Что проверить перед решением и в какие сроки отвечать.",
            [("Перед согласованием",
              "Проверьте три вещи:\n\n"
              "- **Пересечения**: не уходят ли в отпуск одновременно ключевые люди.\n"
              "- **Замену** на время отсутствия.\n"
              "- **Историю**: AI Jana покажет, сколько дней останется и были ли недавно авансы."),
             ("Сроки решения",
              "Решение принимается **не позже двух рабочих дней**. Отказ всегда сопровождается понятным комментарием.")],
            [("Сколько времени есть на решение по заявке?", ["Неделя", "Два рабочих дня", "Сколько угодно"], 1),
             ("Что обязательно при отказе?", ["Комментарий с причиной", "Звонок в HR", "Ничего"], 0)]),
    }


def _enroll(db: Session, emp_id: int, course: Course, assigned_by: int | None, due: date | None = None) -> Enrollment:
    e = db.scalar(select(Enrollment).where(Enrollment.employee_id == emp_id, Enrollment.course_id == course.id))
    if e is None:
        e = Enrollment(employee_id=emp_id, course_id=course.id, assigned_by_user_id=assigned_by, due_date=due)
        db.add(e)
        db.flush()
    return e


def _xp(db: Session, emp_id: int, kind: str, ref: str, xp: int, title: str, at: datetime) -> None:
    game._give(db, game.Rewards(), emp_id, kind, ref, xp, title, at)


def _lessons(db: Session, e: Enrollment, course: Course, days: list[date]) -> None:
    for i, lesson in enumerate(course.lessons):
        if i >= len(days):
            break
        if lesson.id not in e.completed_lesson_ids:
            e.completed_lesson_ids = [*e.completed_lesson_ids, lesson.id]
        _xp(db, e.employee_id, "lesson", f"lesson:{lesson.id}", game.XP_LESSON, f"Урок «{lesson.title}»",
            _ts(days[i], 10 + i, 15))
    total = len(course.lessons) + 1
    e.progress = round(100 * len(e.completed_lesson_ids) / total)
    if e.status == EnrollmentStatus.assigned:
        e.status = EnrollmentStatus.in_progress


def _complete(db: Session, e: Enrollment, course: Course, day: date, score: int, attempts: int = 1) -> None:
    e.status, e.progress, e.score, e.attempts = EnrollmentStatus.completed, 100, score, attempts
    e.completed_lesson_ids = [l.id for l in course.lessons]
    e.completed_at = _ts(day, 16)
    for i, lesson in enumerate(course.lessons):
        _xp(db, e.employee_id, "lesson", f"lesson:{lesson.id}", game.XP_LESSON, f"Урок «{lesson.title}»",
            _ts(day, 14, i * 10))
    _xp(db, e.employee_id, "course", f"course:{course.id}", game.XP_QUIZ, f"Курс «{course.title}» пройден", _ts(day, 16))
    if score == 100:
        _xp(db, e.employee_id, "perfect", f"perfect:{course.id}", game.XP_PERFECT, "Тест на 100%", _ts(day, 16))
    if attempts == 1:
        _xp(db, e.employee_id, "first_try", f"first_try:{course.id}", game.XP_FIRST_TRY, "С первой попытки", _ts(day, 16))
    if e.due_date and e.due_date >= day:
        _xp(db, e.employee_id, "early", f"early:{course.id}", game.XP_EARLY, "Раньше срока", _ts(day, 16))


def seed_academy(db: Session, today: date, u: dict, e: dict, c1: Course, c2: Course) -> None:
    cs = build_courses()
    db.add_all(cs.values())
    db.flush()
    base = {"welcome": c1, "warehouse": c2, **cs}

    def track(slug, title, desc, audience, icon, xp, steps):
        t = Track(slug=slug, title=title, description=desc, audience=audience, icon=icon, xp_reward=xp)
        t.steps = [TrackCourse(course_id=base[k].id, order=i, required=req) for i, (k, req) in enumerate(steps, 1)]
        db.add(t)
        return t

    onboarding = track("onboarding", "Адаптация новичка",
                       "Всё, что нужно в первый месяц: компания, кадровые сервисы и безопасность.",
                       "Все новые сотрудники, первые 30 дней", "sprout", 150,
                       [("welcome", True), ("requests", True), ("security", True)])
    logistics = track("logistics", "Логистика и склад",
                      "Безопасная работа на складе, трансграничный маршрут посылки и сервис для клиента.",
                      "Склад, сортировка, доставка", "truck", 200,
                      [("warehouse", True), ("crossborder", True), ("service", False)])
    leader = track("leader", "Руководитель",
                   "Обратная связь, встречи 1:1 и быстрые решения по заявкам команды.",
                   "Руководители отделов и групп", "crown", 200,
                   [("feedback", True), ("approvals", True), ("security", False)])
    db.flush()

    hr, mgr = u["hr"].id, u["manager"].id
    d = lambda n: today - timedelta(days=n)

    for emp_key, t, by, due in [("alia", onboarding, hr, today + timedelta(days=7)), ("alia", logistics, mgr, None),
                                ("daniyar", logistics, mgr, today + timedelta(days=10)), ("nurbol", logistics, mgr, None),
                                ("anastasia", onboarding, hr, today - timedelta(days=3)),
                                ("head_log", leader, hr, today + timedelta(days=14))]:
        game.enroll_track(db, e[emp_key], t, db.get(User, by), due)

    for en in db.scalars(select(Enrollment).where(Enrollment.status == EnrollmentStatus.completed)):
        course = db.get(Course, en.course_id)
        _complete(db, en, course, en.completed_at.astimezone(TZ).date(), en.score or 100)

    alia, dan, nur, kas = e["alia"].id, e["daniyar"].id, e["nurbol"].id, e["head_log"].id
    en = _enroll(db, alia, cs["requests"], hr)
    _lessons(db, en, cs["requests"], [d(3), d(2)])
    _complete(db, en, cs["requests"], d(1), 100)
    _lessons(db, _enroll(db, alia, c1, hr), c1, [d(1)])

    _complete(db, _enroll(db, dan, cs["crossborder"], mgr), cs["crossborder"], d(5), 100, attempts=2)
    _lessons(db, _enroll(db, dan, cs["service"], mgr), cs["service"], [d(4), d(3)])
    _lessons(db, _enroll(db, dan, c2, mgr), c2, [d(2)])

    _complete(db, _enroll(db, nur, cs["crossborder"], mgr), cs["crossborder"], d(380), 100)
    _complete(db, _enroll(db, kas, cs["feedback"], hr), cs["feedback"], d(20), 100)
    _lessons(db, _enroll(db, kas, cs["approvals"], hr), cs["approvals"], [d(2)])
    _complete(db, _enroll(db, e["madina"].id, cs["security"], None), cs["security"], d(30), 100)
    _complete(db, _enroll(db, e["hr"].id, cs["security"], None), cs["security"], d(50), 100)
    _complete(db, _enroll(db, e["hr"].id, cs["feedback"], None), cs["feedback"], d(45), 100)
    _complete(db, _enroll(db, e["head_fin"].id, cs["feedback"], None), cs["feedback"], d(6), 100)
    db.flush()

    for emp in e.values():
        game.check_tracks(db, emp.id, game.Rewards())
    db.flush()
    for te in db.scalars(select(TrackEnrollment).where(TrackEnrollment.completed_at.is_not(None))):
        ids = [s.course_id for s in te.track.steps if s.required]
        last = max(x.completed_at for x in db.scalars(select(Enrollment).where(
            Enrollment.employee_id == te.employee_id, Enrollment.course_id.in_(ids))))
        te.completed_at = last
        ev = db.scalar(select(XpEvent).where(XpEvent.employee_id == te.employee_id, XpEvent.ref == f"track:{te.track_id}"))
        if ev:
            ev.created_at = last
    db.flush()
    for emp in e.values():
        game.evaluate_badges(db, emp.id)
    db.flush()

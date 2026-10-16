import hashlib
import logging
import re
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.integrations import get_hr_system, get_mailer
from app.integrations.base import NewHire
from app.integrations.mock_mail import MockMailAdapter
from app.integrations.smtp_mail import MailDeliveryError
from app.models import (
    AccountStatus, Candidate, CandidateStatus, Course, Employee, Enrollment, InviteToken, Role, Track, User,
)
from app.services.gamification import enroll_track
from app.services.mail_templates import invite_email
from app.services.notifications import notify

log = logging.getLogger("uvicorn.error")

S = CandidateStatus

ALLOWED_STATUS_CHANGES: dict[CandidateStatus, set[CandidateStatus]] = {
    S.interview_pending: {S.interview_passed, S.interview_failed},
    S.interview_passed: {S.interview_pending, S.interview_failed},
    S.interview_failed: {S.interview_pending, S.interview_passed},
}
WELCOME_COURSE_TITLE = "Добро пожаловать в Jana Post"


def _bad(msg: str, code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(code, msg)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _email_taken(db: Session, email: str, exclude_candidate_id: int | None = None) -> bool:
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        return True
    q = select(Candidate.id).where(
        func.lower(Candidate.email) == email,
        Candidate.status.not_in([S.archived, S.hired]),
    )
    if exclude_candidate_id:
        q = q.where(Candidate.id != exclude_candidate_id)
    return db.scalar(q) is not None


def _check_manager(db: Session, manager_id: int | None) -> None:
    if manager_id is not None and db.get(Employee, manager_id) is None:
        raise _bad("Руководитель не найден")


def create_candidate(db: Session, hr: User, data: dict) -> Candidate:
    data["email"] = data["email"].lower().strip()
    if _email_taken(db, data["email"]):
        raise _bad("Этот email уже используется сотрудником или другим кандидатом")
    _check_manager(db, data.get("manager_id"))
    c = Candidate(**data, created_by_user_id=hr.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def update_candidate(db: Session, c: Candidate, data: dict) -> Candidate:
    if c.status in (S.hired, S.archived):
        raise _bad("Карточку трудоустроенного или открепленного кандидата менять нельзя")
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower().strip()
        if _email_taken(db, data["email"], exclude_candidate_id=c.id):
            raise _bad("Этот email уже используется сотрудником или другим кандидатом")
    _check_manager(db, data.get("manager_id"))
    for k, v in data.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


def set_status(db: Session, c: Candidate, new: CandidateStatus, comment: str | None) -> Candidate:
    if new not in ALLOWED_STATUS_CHANGES.get(c.status, set()):
        raise _bad("Такой переход статуса недоступен")
    c.status, c.status_comment = new, comment
    db.commit()
    db.refresh(c)
    return c


def archive(db: Session, c: Candidate, comment: str | None) -> Candidate:
    if c.status in (S.hired, S.archived):
        raise _bad("Кандидата нельзя открепить в текущем статусе")
    c.status, c.status_comment = S.archived, comment
    db.commit()
    db.refresh(c)
    return c


def restore(db: Session, c: Candidate) -> Candidate:
    if c.status != S.archived:
        raise _bad("Кандидат не откреплён")
    if _email_taken(db, c.email.lower(), exclude_candidate_id=c.id):
        raise _bad("Email кандидата уже занят")
    c.status, c.status_comment = S.interview_pending, None
    db.commit()
    db.refresh(c)
    return c


def hire(db: Session, hr: User, c: Candidate, start_date: date, role: Role) -> tuple[User, str]:
    if c.status != S.interview_passed:
        raise _bad("Трудоустроить можно только кандидата, успешно прошедшего собеседование")
    if role == Role.hr:
        raise _bad("Роль HR выдаётся отдельно администратором")
    if db.scalar(select(User.id).where(func.lower(User.email) == c.email.lower())):
        raise _bad("Пользователь с таким email уже существует")

    manager = db.get(Employee, c.manager_id) if c.manager_id else None
    external_id = get_hr_system(db).create_employee(NewHire(
        full_name=c.full_name, email=c.email, phone=c.phone, position=c.position, department=c.department,
        manager_external_id=manager.external_id if manager else None, hire_date=start_date,
    ))
    employee = db.scalar(select(Employee).where(Employee.external_id == external_id))
    user = User(email=c.email.lower(), password_hash=None, role=role, status=AccountStatus.invited, employee=employee)
    db.add(user)
    c.status, c.employee_id = S.hired, employee.id

    welcome = db.scalar(select(Course).where(Course.title == WELCOME_COURSE_TITLE))
    track = db.scalar(select(Track).where(Track.slug == "onboarding"))
    db.flush()
    if track:
        enroll_track(db, employee, track, hr, start_date + timedelta(days=30))
        notify(db, user.id, "course_assigned", f"Назначена траектория: {track.title}",
               f"Курсов: {len(track.steps)}, пройти за первый месяц", "/academy")
    elif welcome:
        db.add(Enrollment(employee_id=employee.id, course_id=welcome.id, assigned_by_user_id=hr.id,
                          due_date=start_date + timedelta(days=7)))
        notify(db, user.id, "course_assigned", f"Назначен курс: {welcome.title}", None, f"/academy/{welcome.id}")
    notify(db, user.id, "system", "Добро пожаловать в JanaMen!", "Здесь ваш профиль, заявки, обучение и AI Jana", "/")
    if manager and manager.user:
        notify(db, manager.user.id, "system", f"В команду добавлен сотрудник: {c.full_name}",
               f"{c.position}, выход {start_date.strftime('%d.%m.%Y')}", "/team")

    url = issue_invite(db, hr, user, commit=False)
    db.commit()
    db.refresh(user)
    return user, url


def issue_invite(db: Session, actor: User, user: User, commit: bool = True) -> str:
    if user.status == AccountStatus.blocked:
        raise _bad("Доступ заблокирован. Сначала разблокируйте сотрудника")
    db.execute(update(InviteToken).where(
        InviteToken.user_id == user.id, InviteToken.used_at.is_(None), InviteToken.revoked_at.is_(None),
    ).values(revoked_at=_now()))
    raw = secrets.token_urlsafe(32)
    db.add(InviteToken(user_id=user.id, token_hash=_hash_token(raw), created_by_user_id=actor.id,
                       expires_at=_now() + timedelta(hours=settings.invite_ttl_hours)))
    url = f"{settings.app_base_url.rstrip('/')}/activate?token={raw}"
    if commit:
        db.commit()
    return url


def send_invite_email(user: User, url: str) -> tuple[bool, str | None]:
    first = user.status == AccountStatus.invited
    subject, text, html = invite_email(user.employee.full_name, user.employee.position, url, first,
                                       settings.invite_ttl_hours)
    mailer = get_mailer()
    try:
        mailer.send(to=user.email, subject=subject, body=text, html=html)
    except MailDeliveryError as e:
        log.warning("Приглашение для %s не отправлено: %s", user.email, e)
        return False, str(e)
    except Exception:
        log.exception("Ошибка отправки приглашения для %s", user.email)
        return False, "Не удалось отправить письмо"
    if isinstance(mailer, MockMailAdapter):
        return False, "Отправка писем выключена: укажите SMTP_USER и SMTP_PASSWORD в .env"
    log.info("Приглашение отправлено на %s", user.email)
    return True, None


def _valid_token(db: Session, raw: str) -> InviteToken:
    t = db.scalar(select(InviteToken).where(InviteToken.token_hash == _hash_token(raw)))
    if (t is None or t.used_at or t.revoked_at or _aware(t.expires_at) < _now()
            or t.user.status == AccountStatus.blocked):
        raise _bad("Ссылка недействительна или устарела. Попросите HR отправить новую")
    return t


def invite_info(db: Session, raw: str) -> dict:
    t = _valid_token(db, raw)
    e = t.user.employee
    return {"full_name": e.full_name, "position": e.position, "company": e.company,
            "email": t.user.email, "expires_at": t.expires_at, "is_reset": t.user.status == AccountStatus.active}


def validate_password(password: str) -> None:
    if len(password) < 8 or not re.search(r"[A-Za-zА-Яа-яЁё]", password) or not re.search(r"\d", password):
        raise _bad("Пароль должен быть не короче 8 символов и содержать буквы и цифры")


def activate(db: Session, raw: str, password: str) -> User:
    t = _valid_token(db, raw)
    validate_password(password)
    user = t.user
    user.password_hash = hash_password(password)
    user.status = AccountStatus.active
    t.used_at = _now()
    db.commit()
    db.refresh(user)
    return user


def set_blocked(db: Session, actor: User, user: User, blocked: bool) -> User:
    if user.id == actor.id:
        raise _bad("Нельзя заблокировать собственную учётную запись")
    if blocked:
        user.status = AccountStatus.blocked
        db.execute(update(InviteToken).where(
            InviteToken.user_id == user.id, InviteToken.used_at.is_(None), InviteToken.revoked_at.is_(None),
        ).values(revoked_at=_now()))
    else:
        user.status = AccountStatus.active if user.password_hash else AccountStatus.invited
    db.commit()
    db.refresh(user)
    return user


def last_invite(db: Session, user_id: int) -> InviteToken | None:
    return db.scalar(select(InviteToken).where(InviteToken.user_id == user_id)
                     .order_by(InviteToken.created_at.desc(), InviteToken.id.desc()).limit(1))

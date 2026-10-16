from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_roles
from app.db import get_db
from app.models import Candidate, CandidateStatus, Role, User
from app.schemas import (
    AccountOut, ArchiveIn, CandidateIn, CandidateOut, CandidateStatusIn, CandidateUpdate, HireIn, HireOut, InviteOut,
)
from app.services import onboarding

router = APIRouter(prefix="/hr", tags=["hr"])
hr_only = require_roles(Role.hr)


def _candidate(db: Session, candidate_id: int) -> Candidate:
    c = db.get(Candidate, candidate_id)
    if c is None:
        raise HTTPException(404, "Кандидат не найден")
    return c


def _user(db: Session, user_id: int) -> User:
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(404, "Пользователь не найден")
    return u


def _deliver(db: Session, user: User, url: str) -> dict:
    sent, error = onboarding.send_invite_email(user, url)
    t = onboarding.last_invite(db, user.id)
    return {"sent_to": user.email, "expires_at": t.expires_at, "email_sent": sent, "email_error": error,
            "invite_url": url if settings.expose_invite_links or not sent else None}


@router.get("/candidates", response_model=list[CandidateOut])
def list_candidates(status: CandidateStatus | None = None, _: User = Depends(hr_only), db: Session = Depends(get_db)):
    q = select(Candidate).order_by(Candidate.created_at.desc())
    if status:
        q = q.where(Candidate.status == status)
    return db.scalars(q).all()


@router.post("/candidates", response_model=CandidateOut, status_code=201)
def create_candidate(data: CandidateIn, hr: User = Depends(hr_only), db: Session = Depends(get_db)):
    return onboarding.create_candidate(db, hr, data.model_dump())


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, _: User = Depends(hr_only), db: Session = Depends(get_db)):
    return _candidate(db, candidate_id)


@router.patch("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(candidate_id: int, data: CandidateUpdate, _: User = Depends(hr_only),
                     db: Session = Depends(get_db)):
    return onboarding.update_candidate(db, _candidate(db, candidate_id), data.model_dump(exclude_unset=True))


@router.post("/candidates/{candidate_id}/status", response_model=CandidateOut)
def set_status(candidate_id: int, data: CandidateStatusIn, _: User = Depends(hr_only), db: Session = Depends(get_db)):
    return onboarding.set_status(db, _candidate(db, candidate_id), CandidateStatus(data.status), data.comment)


@router.post("/candidates/{candidate_id}/archive", response_model=CandidateOut)
def archive(candidate_id: int, data: ArchiveIn, _: User = Depends(hr_only), db: Session = Depends(get_db)):
    return onboarding.archive(db, _candidate(db, candidate_id), data.comment)


@router.post("/candidates/{candidate_id}/restore", response_model=CandidateOut)
def restore(candidate_id: int, _: User = Depends(hr_only), db: Session = Depends(get_db)):
    return onboarding.restore(db, _candidate(db, candidate_id))


@router.post("/candidates/{candidate_id}/hire", response_model=HireOut)
def hire(candidate_id: int, data: HireIn, hr: User = Depends(hr_only), db: Session = Depends(get_db)):
    c = _candidate(db, candidate_id)
    user, url = onboarding.hire(db, hr, c, data.start_date, Role(data.role))
    db.refresh(c)
    return {**_deliver(db, user, url), "candidate": c, "user_id": user.id, "employee_id": user.employee_id}


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(_: User = Depends(hr_only), db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()
    out = []
    for u in users:
        t = onboarding.last_invite(db, u.id)
        pending = bool(t and not t.used_at and not t.revoked_at
                       and onboarding._aware(t.expires_at) > onboarding._now())
        out.append(AccountOut(
            user_id=u.id, email=u.email, role=u.role, status=u.status, employee=u.employee,
            invite_sent_at=t.created_at if t else None, invite_expires_at=t.expires_at if t else None,
            invite_pending=pending,
        ))
    return out


@router.post("/accounts/{user_id}/invite", response_model=InviteOut)
def send_invite(user_id: int, hr: User = Depends(hr_only), db: Session = Depends(get_db)):
    user = _user(db, user_id)
    url = onboarding.issue_invite(db, hr, user)
    return _deliver(db, user, url)


@router.post("/accounts/{user_id}/block", response_model=AccountOut)
def block(user_id: int, hr: User = Depends(hr_only), db: Session = Depends(get_db)):
    u = onboarding.set_blocked(db, hr, _user(db, user_id), True)
    return AccountOut(user_id=u.id, email=u.email, role=u.role, status=u.status, employee=u.employee)


@router.post("/accounts/{user_id}/unblock", response_model=AccountOut)
def unblock(user_id: int, hr: User = Depends(hr_only), db: Session = Depends(get_db)):
    u = onboarding.set_blocked(db, hr, _user(db, user_id), False)
    return AccountOut(user_id=u.id, email=u.email, role=u.role, status=u.status, employee=u.employee)

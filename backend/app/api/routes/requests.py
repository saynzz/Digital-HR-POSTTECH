from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.permissions import can_view_request, ensure, team_employee_ids
from app.db import get_db
from app.models import HRRequest, RequestStatus, RequestType, Role, User
from app.schemas import DecisionIn, RequestCreate, RequestDetail, RequestOut
from app.services import request_workflow as wf

router = APIRouter(prefix="/requests", tags=["requests"])


@router.get("", response_model=list[RequestOut])
def list_requests(
    scope: Literal["my", "team", "all"] = "my",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = select(HRRequest).order_by(HRRequest.created_at.desc())
    if scope == "my":
        q = q.where(HRRequest.employee_id == user.employee_id)
    elif scope == "team":
        ensure(user.role in (Role.manager, Role.hr))
        if user.role == Role.manager:
            q = q.where(HRRequest.employee_id.in_(team_employee_ids(db, user)))
    else:
        ensure(user.role == Role.hr)
    return db.scalars(q).all()


@router.post("", response_model=RequestDetail, status_code=201)
def create_request(data: RequestCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.type == RequestType.vacation:
        if not data.vacation:
            raise HTTPException(400, "Укажите даты отпуска")
        payload = data.vacation.model_dump(mode="json")
    else:
        if not data.advance:
            raise HTTPException(400, "Укажите сумму аванса")
        payload = data.advance.model_dump(mode="json")
    req = wf.create_request(db, user, data.type, payload)
    return _detail(req, user)


@router.get("/{request_id}", response_model=RequestDetail)
def get_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id)
    ensure(can_view_request(db, user, req))
    return _detail(req, user)


@router.post("/{request_id}/decision", response_model=RequestDetail)
def decide(request_id: int, data: DecisionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id)
    ensure(can_view_request(db, user, req))
    req = wf.decide(db, user, req, data.decision == "approve", data.comment)
    return _detail(req, user)


@router.post("/{request_id}/cancel", response_model=RequestDetail)
def cancel(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    req = _load(db, request_id)
    ensure(can_view_request(db, user, req))
    return _detail(wf.cancel(db, user, req), user)


def _load(db: Session, request_id: int) -> HRRequest:
    req = db.get(HRRequest, request_id)
    if req is None:
        raise HTTPException(404, "Заявка не найдена")
    return req


def _detail(req: HRRequest, user: User) -> RequestDetail:
    can_decide = (
        (req.status == RequestStatus.pending_manager and req.employee.manager_id == user.employee_id)
        or (req.status == RequestStatus.pending_hr and user.role == Role.hr)
    )
    can_cancel = req.employee_id == user.employee_id and req.status in (
        RequestStatus.pending_manager, RequestStatus.pending_hr)
    out = RequestDetail.model_validate(req)
    out.can_decide, out.can_cancel = can_decide, can_cancel
    return out

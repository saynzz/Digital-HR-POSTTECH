from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations import get_docflow, get_hr_system
from app.models import Employee, HRRequest, RequestEvent, RequestStatus, RequestType, Role, User
from app.services.notifications import notify, notify_role

TYPE_LABEL = {RequestType.vacation: "Отпуск", RequestType.advance: "Аванс"}
STATUS_LABEL = {
    RequestStatus.pending_manager: "На согласовании у руководителя",
    RequestStatus.pending_hr: "На оформлении в HR",
    RequestStatus.approved: "Оформлено",
    RequestStatus.rejected: "Отклонено",
    RequestStatus.cancelled: "Отозвано",
}


def _bad(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, msg)


def _user_of(db: Session, employee_id: int | None) -> User | None:
    if employee_id is None:
        return None
    return db.scalar(select(User).where(User.employee_id == employee_id))


def _log(db: Session, req: HRRequest, to: RequestStatus, actor: User | None, comment: str | None = None) -> None:
    db.add(RequestEvent(request=req, from_status=req.status if req.id else None, to_status=to,
                        actor_user_id=actor.id if actor else None, comment=comment))
    req.status = to


def _notify_owner(db: Session, req: HRRequest) -> None:
    owner = _user_of(db, req.employee_id)
    if owner:
        notify(db, owner.id, "request_status",
               f"{TYPE_LABEL[req.type]}: {STATUS_LABEL[req.status]}",
               f"Заявка №{req.id}", f"/requests/{req.id}")


def create_request(db: Session, user: User, type: RequestType, payload: dict) -> HRRequest:
    employee: Employee = user.employee
    if type == RequestType.vacation:
        start, end = date.fromisoformat(payload["start_date"]), date.fromisoformat(payload["end_date"])
        if end < start:
            raise _bad("Дата окончания раньше даты начала")
        days = (end - start).days + 1
        balance = get_hr_system(db).get_vacation_balance(employee.external_id)
        if days > balance:
            raise _bad(f"Недостаточно дней отпуска: запрошено {days}, доступно {balance}")
        payload = {**payload, "days": days}
    elif type == RequestType.advance:
        if int(payload.get("amount", 0)) <= 0:
            raise _bad("Сумма аванса должна быть больше нуля")

    req = HRRequest(type=type, employee_id=employee.id, payload=payload)
    first = RequestStatus.pending_manager if employee.manager_id else RequestStatus.pending_hr
    req.status = first
    db.add(req)
    db.flush()
    db.add(RequestEvent(request_id=req.id, from_status=None, to_status=first, actor_user_id=user.id, comment="Заявка создана"))

    if first == RequestStatus.pending_manager:
        manager = _user_of(db, employee.manager_id)
        if manager:
            notify(db, manager.id, "request_status", f"Новая заявка: {TYPE_LABEL[type]}",
                   f"{employee.full_name} — заявка №{req.id} ждёт согласования", f"/requests/{req.id}")
    else:
        notify_role(db, Role.hr, "request_status", f"Новая заявка: {TYPE_LABEL[type]}",
                    f"{employee.full_name} — заявка №{req.id}", f"/requests/{req.id}")
    _notify_owner(db, req)
    db.commit()
    db.refresh(req)
    return req


def decide(db: Session, user: User, req: HRRequest, approve: bool, comment: str | None) -> HRRequest:
    if req.status == RequestStatus.pending_manager:
        is_direct_manager = user.employee_id == req.employee.manager_id
        if not is_direct_manager:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Решение принимает непосредственный руководитель")
        if approve:
            _log(db, req, RequestStatus.pending_hr, user, comment)
            notify_role(db, Role.hr, "request_status", f"Заявка №{req.id} согласована руководителем",
                        req.employee.full_name, f"/requests/{req.id}")
        else:
            _log(db, req, RequestStatus.rejected, user, comment)

    elif req.status == RequestStatus.pending_hr:
        if user.role != Role.hr:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Оформление выполняет HR")
        if approve:
            hr_system, docflow = get_hr_system(db), get_docflow()
            ext = req.employee.external_id
            p = req.payload
            if req.type == RequestType.vacation:
                zup_doc = hr_system.register_vacation(ext, date.fromisoformat(p["start_date"]),
                                                      date.fromisoformat(p["end_date"]), p["days"])
            else:
                zup_doc = hr_system.register_advance(ext, int(p["amount"]))
            req.external_doc_id = docflow.create_document(req.type.value, ext, p)
            _log(db, req, RequestStatus.approved, user,
                 comment or f"Проведено в 1С:ЗУП ({zup_doc}), документ {req.external_doc_id}")
        else:
            _log(db, req, RequestStatus.rejected, user, comment)
    else:
        raise _bad("По этой заявке решение уже принято")

    _notify_owner(db, req)
    db.commit()
    db.refresh(req)
    return req


def cancel(db: Session, user: User, req: HRRequest) -> HRRequest:
    if req.employee_id != user.employee_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Отозвать можно только свою заявку")
    if req.status not in (RequestStatus.pending_manager, RequestStatus.pending_hr):
        raise _bad("Заявку уже нельзя отозвать")
    _log(db, req, RequestStatus.cancelled, user, "Отозвано сотрудником")
    db.commit()
    db.refresh(req)
    return req

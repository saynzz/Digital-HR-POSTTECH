from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee, HRRequest, Role, User


def team_employee_ids(db: Session, manager: User) -> set[int]:
    rows = db.scalars(select(Employee.id).where(Employee.manager_id == manager.employee_id))
    return set(rows)


def can_view_employee(db: Session, user: User, employee_id: int) -> bool:
    if user.role == Role.hr:
        return True
    if user.employee_id == employee_id:
        return True
    if user.role == Role.manager:
        return employee_id in team_employee_ids(db, user)
    return False


def can_view_request(db: Session, user: User, req: HRRequest) -> bool:
    return can_view_employee(db, user, req.employee_id)


def ensure(condition: bool, message: str = "Нет доступа") -> None:
    if not condition:
        raise HTTPException(status.HTTP_403_FORBIDDEN, message)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.permissions import can_view_employee, ensure
from app.db import get_db
from app.models import Employee, Role, User
from app.schemas import EmployeeOut

router = APIRouter(tags=["employees"])


@router.get("/team", response_model=list[EmployeeOut])
def my_team(user: User = Depends(require_roles(Role.manager, Role.hr)), db: Session = Depends(get_db)):
    q = select(Employee).order_by(Employee.full_name)
    if user.role == Role.manager:
        q = q.where(Employee.manager_id == user.employee_id)
    return db.scalars(q).all()


@router.get("/employees/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure(can_view_employee(db, user, employee_id))
    emp = db.get(Employee, employee_id)
    if emp is None:
        raise HTTPException(404, "Сотрудник не найден")
    return emp

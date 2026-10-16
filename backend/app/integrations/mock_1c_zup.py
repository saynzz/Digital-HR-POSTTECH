import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.base import EmployeeRecord
from app.models import Employee


class Mock1CZupAdapter:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, external_id: str) -> Employee | None:
        return self.db.scalar(select(Employee).where(Employee.external_id == external_id))

    def get_employee(self, external_id: str) -> EmployeeRecord | None:
        e = self._get(external_id)
        if e is None:
            return None
        return EmployeeRecord(
            external_id=e.external_id,
            full_name=e.full_name,
            company=e.company,
            position=e.position,
            department=e.department,
            hire_date=e.hire_date,
            manager_external_id=e.manager.external_id if e.manager else None,
            vacation_balance_days=e.vacation_balance_days,
        )

    def get_vacation_balance(self, external_id: str) -> int:
        e = self._get(external_id)
        return e.vacation_balance_days if e else 0

    def register_vacation(self, external_id: str, start: date, end: date, days: int) -> str:
        e = self._get(external_id)
        if e is None:
            raise ValueError("Сотрудник не найден в 1С:ЗУП")
        e.vacation_balance_days = max(0, e.vacation_balance_days - days)
        return f"ZUP-VAC-{uuid.uuid4().hex[:8].upper()}"

    def register_advance(self, external_id: str, amount: int) -> str:
        return f"ZUP-ADV-{uuid.uuid4().hex[:8].upper()}"

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass
class EmployeeRecord:
    external_id: str
    full_name: str
    company: str
    position: str
    department: str
    hire_date: date
    manager_external_id: str | None
    vacation_balance_days: int


class HRSystemAdapter(Protocol):
    def get_employee(self, external_id: str) -> EmployeeRecord | None: ...

    def get_vacation_balance(self, external_id: str) -> int: ...

    def register_vacation(self, external_id: str, start: date, end: date, days: int) -> str:
        ...

    def register_advance(self, external_id: str, amount: int) -> str:
        ...


class DocumentFlowAdapter(Protocol):
    def create_document(self, kind: str, employee_external_id: str, payload: dict) -> str:
        ...

    def get_document_status(self, doc_id: str) -> str: ...

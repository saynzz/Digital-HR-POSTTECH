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


@dataclass
class NewHire:
    full_name: str
    email: str
    phone: str | None
    position: str
    department: str
    manager_external_id: str | None
    hire_date: date


class HRSystemAdapter(Protocol):
    def create_employee(self, hire: NewHire) -> str: ...

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


class MailAdapter(Protocol):
    def send(self, to: str, subject: str, body: str, html: str | None = None) -> None: ...

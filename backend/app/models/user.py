import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Role(str, enum.Enum):
    employee = "employee"
    manager = "manager"
    hr = "hr"


class AccountStatus(str, enum.Enum):
    invited = "invited"
    active = "active"
    blocked = "blocked"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(64), unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    company: Mapped[str] = mapped_column(String(255))
    position: Mapped[str] = mapped_column(String(255))
    department: Mapped[str] = mapped_column(String(255))
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), nullable=True)
    hire_date: Mapped[date] = mapped_column(Date)
    vacation_balance_days: Mapped[int] = mapped_column(Integer, default=0)

    manager: Mapped["Employee | None"] = relationship(remote_side=[id], foreign_keys=[manager_id])
    user: Mapped["User | None"] = relationship(back_populates="employee")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role))
    status: Mapped[AccountStatus] = mapped_column(Enum(AccountStatus), default=AccountStatus.active)
    locale: Mapped[str] = mapped_column(String(5), default="ru")
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), unique=True)

    employee: Mapped[Employee] = relationship(back_populates="user")

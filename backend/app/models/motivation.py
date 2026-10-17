import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.db_types import UTCDateTime
from app.models.request import utcnow


class CoinTx(Base):
    __tablename__ = "coin_txs"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(255))
    ref: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    cost: Mapped[int] = mapped_column(Integer)
    icon: Mapped[str] = mapped_column(String(32), default="gift")
    stock: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class RedemptionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class Redemption(Base):
    __tablename__ = "redemptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    reward_id: Mapped[int] = mapped_column(ForeignKey("rewards.id"))
    cost: Mapped[int] = mapped_column(Integer)
    status: Mapped[RedemptionStatus] = mapped_column(Enum(RedemptionStatus), default=RedemptionStatus.pending)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)

    reward: Mapped[Reward] = relationship()
    employee = relationship("Employee")


class Kudos(Base):
    __tablename__ = "kudos"

    id: Mapped[int] = mapped_column(primary_key=True)
    from_employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    to_employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    value: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    sender = relationship("Employee", foreign_keys=[from_employee_id])
    receiver = relationship("Employee", foreign_keys=[to_employee_id])


class TeamGoal(Base):
    __tablename__ = "team_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    department: Mapped[str] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(255))
    reward: Mapped[str] = mapped_column(String(255))
    target_xp: Mapped[int] = mapped_column(Integer)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    achieved_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

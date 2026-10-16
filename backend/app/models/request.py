import enum
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RequestType(str, enum.Enum):
    vacation = "vacation"
    advance = "advance"


class RequestStatus(str, enum.Enum):
    pending_manager = "pending_manager"
    pending_hr = "pending_hr"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class HRRequest(Base):
    __tablename__ = "hr_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[RequestType] = mapped_column(Enum(RequestType))
    status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus), default=RequestStatus.pending_manager)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    external_doc_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    employee = relationship("Employee")
    events: Mapped[list["RequestEvent"]] = relationship(
        back_populates="request", order_by="RequestEvent.created_at", cascade="all, delete-orphan"
    )


class RequestEvent(Base):
    __tablename__ = "request_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("hr_requests.id"), index=True)
    from_status: Mapped[RequestStatus | None] = mapped_column(Enum(RequestStatus), nullable=True)
    to_status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus))
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    request: Mapped[HRRequest] = relationship(back_populates="events")
    actor = relationship("User")

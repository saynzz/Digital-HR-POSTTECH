from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import AccountStatus, CandidateStatus, EnrollmentStatus, RequestStatus, RequestType, Role


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class EmployeeShort(ORM):
    id: int
    full_name: str
    position: str
    department: str


class EmployeeOut(ORM):
    id: int
    external_id: str
    full_name: str
    company: str
    position: str
    department: str
    hire_date: date
    vacation_balance_days: int
    manager: EmployeeShort | None = None


class MeOut(BaseModel):
    id: int
    email: str
    role: Role
    locale: str
    employee: EmployeeOut


class VacationPayload(BaseModel):
    start_date: date
    end_date: date
    comment: str | None = None


class AdvancePayload(BaseModel):
    amount: int = Field(gt=0)
    comment: str | None = None


class RequestCreate(BaseModel):
    type: RequestType
    vacation: VacationPayload | None = None
    advance: AdvancePayload | None = None


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject"]
    comment: str | None = None


class RequestEventOut(ORM):
    id: int
    from_status: RequestStatus | None
    to_status: RequestStatus
    comment: str | None
    actor_name: str | None = None
    created_at: datetime


class RequestOut(ORM):
    id: int
    type: RequestType
    status: RequestStatus
    payload: dict
    external_doc_id: str | None
    created_at: datetime
    updated_at: datetime
    employee: EmployeeShort


class RequestDetail(RequestOut):
    events: list[RequestEventOut]
    can_decide: bool = False
    can_cancel: bool = False


class NotificationOut(ORM):
    id: int
    type: str
    title: str
    body: str | None
    link: str | None
    is_read: bool
    created_at: datetime


class CourseOut(ORM):
    id: int
    title: str
    description: str
    duration_min: int


class LessonOut(ORM):
    id: int
    order: int
    title: str
    content: str


class QuestionOut(ORM):
    id: int
    question: str
    options: list[str]


class EnrollmentOut(ORM):
    id: int
    status: EnrollmentStatus
    progress: int
    score: int | None
    due_date: date | None
    completed_lesson_ids: list[int]
    course: CourseOut


class CourseDetail(CourseOut):
    lessons: list[LessonOut]
    questions: list[QuestionOut]
    enrollment: EnrollmentOut | None = None


class QuizSubmit(BaseModel):
    answers: dict[int, int]


class AssignCourseIn(BaseModel):
    employee_id: int
    course_id: int
    due_date: date | None = None


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


class SourceOut(BaseModel):
    doc_id: str
    title: str
    section: str | None = None
    url: str | None = None


class EscalateIn(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


class AskOut(BaseModel):
    answer: str
    sources: list[SourceOut]
    found: bool
    mode: Literal["llm", "extractive", "refusal"]


class CandidateIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32)
    position: str = Field(min_length=2, max_length=255)
    department: str = Field(min_length=2, max_length=255)
    manager_id: int | None = None
    interview_at: datetime | None = None
    planned_start_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)


class CandidateUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=32)
    position: str | None = Field(default=None, min_length=2, max_length=255)
    department: str | None = Field(default=None, min_length=2, max_length=255)
    manager_id: int | None = None
    interview_at: datetime | None = None
    planned_start_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)


class CandidateOut(ORM):
    id: int
    full_name: str
    email: str
    phone: str | None
    position: str
    department: str
    manager: EmployeeShort | None
    interview_at: datetime | None
    planned_start_date: date | None
    notes: str | None
    status: CandidateStatus
    status_comment: str | None
    employee_id: int | None
    created_at: datetime
    updated_at: datetime


class CandidateStatusIn(BaseModel):
    status: Literal["interview_pending", "interview_passed", "interview_failed"]
    comment: str | None = Field(default=None, max_length=1000)


class ArchiveIn(BaseModel):
    comment: str | None = Field(default=None, max_length=1000)


class HireIn(BaseModel):
    start_date: date
    role: Literal["employee", "manager"] = "employee"


class InviteOut(BaseModel):
    sent_to: str
    expires_at: datetime
    email_sent: bool
    email_error: str | None = None
    invite_url: str | None = None


class HireOut(InviteOut):
    candidate: CandidateOut
    user_id: int
    employee_id: int


class AccountOut(BaseModel):
    user_id: int
    email: str
    role: Role
    status: AccountStatus
    employee: EmployeeShort
    invite_sent_at: datetime | None = None
    invite_expires_at: datetime | None = None
    invite_pending: bool = False


class InviteInfoOut(BaseModel):
    full_name: str
    position: str
    company: str
    email: str
    expires_at: datetime
    is_reset: bool


class ActivateIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=1, max_length=128)

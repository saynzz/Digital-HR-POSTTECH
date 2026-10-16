from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import EnrollmentStatus, RequestStatus, RequestType, Role


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


class AskOut(BaseModel):
    answer: str
    sources: list[SourceOut]
    found: bool
    mode: Literal["llm", "extractive", "refusal"]

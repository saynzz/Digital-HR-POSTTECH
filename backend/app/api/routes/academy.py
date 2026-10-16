from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.permissions import can_view_employee, ensure
from app.db import get_db
from app.models import Course, Enrollment, EnrollmentStatus, Role, User
from app.schemas import AssignCourseIn, CourseDetail, CourseOut, EnrollmentOut, QuizSubmit
from app.services.notifications import notify

router = APIRouter(prefix="/academy", tags=["academy"])


def _enrollment(db: Session, user: User, course_id: int) -> Enrollment | None:
    return db.scalar(select(Enrollment).where(
        Enrollment.employee_id == user.employee_id, Enrollment.course_id == course_id))


def _recalc(e: Enrollment) -> None:
    total = len(e.course.lessons) + (1 if e.course.questions else 0)
    done = len(e.completed_lesson_ids) + (1 if e.score is not None else 0)
    e.progress = round(100 * done / total) if total else 0


@router.get("/my", response_model=list[EnrollmentOut])
def my_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Enrollment).where(Enrollment.employee_id == user.employee_id)).all()


@router.get("/courses", response_model=list[CourseOut])
def catalog(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Course).order_by(Course.id)).all()


@router.get("/courses/{course_id}", response_model=CourseDetail)
def course_detail(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(404, "Курс не найден")
    out = CourseDetail.model_validate(course)
    enr = _enrollment(db, user, course_id)
    out.enrollment = EnrollmentOut.model_validate(enr) if enr else None
    return out


@router.post("/courses/{course_id}/start", response_model=EnrollmentOut)
def start_course(course_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.get(Course, course_id) is None:
        raise HTTPException(404, "Курс не найден")
    enr = _enrollment(db, user, course_id)
    if enr is None:
        enr = Enrollment(employee_id=user.employee_id, course_id=course_id, status=EnrollmentStatus.in_progress)
        db.add(enr)
        db.commit()
        db.refresh(enr)
    return enr


@router.post("/courses/{course_id}/lessons/{lesson_id}/complete", response_model=EnrollmentOut)
def complete_lesson(course_id: int, lesson_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enr = _enrollment(db, user, course_id)
    if enr is None:
        raise HTTPException(400, "Курс не назначен")
    if lesson_id not in {l.id for l in enr.course.lessons}:
        raise HTTPException(404, "Урок не найден")
    if lesson_id not in enr.completed_lesson_ids:
        enr.completed_lesson_ids = [*enr.completed_lesson_ids, lesson_id]
    if enr.status == EnrollmentStatus.assigned:
        enr.status = EnrollmentStatus.in_progress
    _recalc(enr)
    db.commit()
    db.refresh(enr)
    return enr


@router.post("/courses/{course_id}/quiz", response_model=EnrollmentOut)
def submit_quiz(course_id: int, data: QuizSubmit, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enr = _enrollment(db, user, course_id)
    if enr is None:
        raise HTTPException(400, "Курс не назначен")
    questions = enr.course.questions
    correct = sum(1 for q in questions if data.answers.get(q.id) == q.correct_index)
    enr.score = round(100 * correct / len(questions)) if questions else 100
    passed = enr.score >= enr.course.pass_score
    enr.status = EnrollmentStatus.completed if passed else EnrollmentStatus.failed
    if passed:
        enr.completed_at = datetime.now(timezone.utc)
        notify(db, user.id, "course_completed", f"Курс пройден: {enr.course.title}",
               f"Результат: {enr.score}%", f"/academy/{course_id}")
    _recalc(enr)
    db.commit()
    db.refresh(enr)
    return enr


@router.post("/assign", response_model=EnrollmentOut, status_code=201)
def assign_course(data: AssignCourseIn, user: User = Depends(require_roles(Role.manager, Role.hr)),
                  db: Session = Depends(get_db)):
    ensure(can_view_employee(db, user, data.employee_id), "Можно назначать только своей команде")
    course = db.get(Course, data.course_id)
    if course is None:
        raise HTTPException(404, "Курс не найден")
    enr = db.scalar(select(Enrollment).where(
        Enrollment.employee_id == data.employee_id, Enrollment.course_id == data.course_id))
    if enr is None:
        enr = Enrollment(employee_id=data.employee_id, course_id=data.course_id,
                         assigned_by_user_id=user.id, due_date=data.due_date)
        db.add(enr)
        target = db.scalar(select(User).where(User.employee_id == data.employee_id))
        if target:
            notify(db, target.id, "course_assigned", f"Назначен курс: {course.title}",
                   f"Срок: {data.due_date}" if data.due_date else None, f"/academy/{course.id}")
        db.commit()
        db.refresh(enr)
    return enr

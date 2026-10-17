from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.permissions import can_view_employee, ensure
from app.db import get_db
from app.models import (
    Course, EarnedBadge, Employee, Enrollment, EnrollmentStatus, Role, Track, TrackEnrollment, User, XpEvent,
)
from app.schemas import (
    AssignCourseIn, AssignTrackIn, CourseDetail, CourseOut, EnrollmentOut, QuizSubmit, TrackOut, TrackStepOut,
)
from app.services import gamification as game
from app.services.notifications import notify

router = APIRouter(prefix="/academy", tags=["academy"])


def _enrollment(db: Session, user: User, course_id: int) -> Enrollment | None:
    return db.scalar(select(Enrollment).where(
        Enrollment.employee_id == user.employee_id, Enrollment.course_id == course_id))


def _recalc(e: Enrollment) -> None:
    total = len(e.course.lessons) + (1 if e.course.questions else 0)
    done = len(e.completed_lesson_ids) + (1 if e.score is not None else 0)
    e.progress = round(100 * done / total) if total else 0


def _with_rewards(enr: Enrollment, rewards: game.Rewards) -> EnrollmentOut:
    out = EnrollmentOut.model_validate(enr)
    out.rewards = rewards.as_dict()
    return out


@router.get("/my", response_model=list[EnrollmentOut])
def my_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    game.remind_deadlines(db, user)
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
    lesson = next((l for l in enr.course.lessons if l.id == lesson_id), None)
    if lesson is None:
        raise HTTPException(404, "Урок не найден")
    if lesson_id not in enr.completed_lesson_ids:
        enr.completed_lesson_ids = [*enr.completed_lesson_ids, lesson_id]
    if enr.status == EnrollmentStatus.assigned:
        enr.status = EnrollmentStatus.in_progress
    _recalc(enr)
    rewards = game.on_lesson(db, enr, lesson)
    db.commit()
    db.refresh(enr)
    return _with_rewards(enr, rewards)


@router.post("/courses/{course_id}/quiz", response_model=EnrollmentOut)
def submit_quiz(course_id: int, data: QuizSubmit, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enr = _enrollment(db, user, course_id)
    if enr is None:
        raise HTTPException(400, "Курс не назначен")
    if enr.status == EnrollmentStatus.completed:
        raise HTTPException(400, "Курс уже пройден")
    questions = enr.course.questions
    correct = sum(1 for q in questions if data.answers.get(q.id) == q.correct_index)
    enr.attempts = (enr.attempts or 0) + 1
    enr.score = round(100 * correct / len(questions)) if questions else 100
    passed = enr.score >= enr.course.pass_score
    enr.status = EnrollmentStatus.completed if passed else EnrollmentStatus.failed
    if passed:
        enr.completed_at = datetime.now(timezone.utc)
        notify(db, user.id, "course_completed", f"Курс пройден: {enr.course.title}",
               f"Результат: {enr.score}%", f"/academy/{course_id}")
    _recalc(enr)
    db.flush()
    rewards = game.on_quiz(db, enr)
    db.commit()
    db.refresh(enr)
    return _with_rewards(enr, rewards)


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


def _track_out(db: Session, track: Track, employee_id: int) -> TrackOut:
    by_course = {e.course_id: e for e in db.scalars(select(Enrollment).where(Enrollment.employee_id == employee_id))}
    te = db.scalar(select(TrackEnrollment).where(TrackEnrollment.employee_id == employee_id,
                                                 TrackEnrollment.track_id == track.id))
    steps, blocked = [], False
    for s in track.steps:
        e = by_course.get(s.course_id)
        started = e is not None and (e.status != EnrollmentStatus.assigned or e.completed_lesson_ids)
        steps.append(TrackStepOut(order=s.order, required=s.required, locked=bool(te) and blocked and not started,
                                  course=CourseOut.model_validate(s.course), status=e.status if e else None,
                                  progress=e.progress if e else 0, score=e.score if e else None))
        if s.required and not (e and e.status == EnrollmentStatus.completed):
            blocked = True
    return TrackOut(id=track.id, slug=track.slug, title=track.title, description=track.description,
                    audience=track.audience, icon=track.icon, xp_reward=track.xp_reward, enrolled=te is not None,
                    due_date=te.due_date if te else None, completed_at=te.completed_at if te else None,
                    progress=game.track_progress(track, by_course), steps=steps)


@router.get("/tracks", response_model=list[TrackOut])
def tracks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    out = [_track_out(db, t, user.employee_id) for t in db.scalars(select(Track).order_by(Track.id))]
    return sorted(out, key=lambda t: (not t.enrolled, t.completed_at is not None, t.id))


@router.get("/tracks/{track_id}", response_model=TrackOut)
def track_detail(track_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.get(Track, track_id)
    if track is None:
        raise HTTPException(404, "Траектория не найдена")
    return _track_out(db, track, user.employee_id)


@router.post("/tracks/{track_id}/join", response_model=TrackOut)
def join_track(track_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.get(Track, track_id)
    if track is None:
        raise HTTPException(404, "Траектория не найдена")
    game.enroll_track(db, user.employee, track, user, None)
    game.check_tracks(db, user.employee_id)
    db.commit()
    return _track_out(db, track, user.employee_id)


@router.post("/tracks/assign", response_model=TrackOut, status_code=201)
def assign_track(data: AssignTrackIn, user: User = Depends(require_roles(Role.manager, Role.hr)),
                 db: Session = Depends(get_db)):
    ensure(can_view_employee(db, user, data.employee_id), "Можно назначать только своей команде")
    track, emp = db.get(Track, data.track_id), db.get(Employee, data.employee_id)
    if track is None or emp is None:
        raise HTTPException(404, "Не найдено")
    game.enroll_track(db, emp, track, user, data.due_date)
    target = db.scalar(select(User).where(User.employee_id == emp.id))
    if target:
        notify(db, target.id, "course_assigned", f"Назначена траектория: {track.title}",
               f"Курсов: {len(track.steps)}" + (f", срок {data.due_date.strftime('%d.%m.%Y')}" if data.due_date else ""),
               "/academy")
    db.commit()
    return _track_out(db, track, emp.id)


@router.get("/game")
def my_game(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    eid = user.employee_id
    xp = game.total_xp(db, eid)
    earned = {b.code: b.earned_at for b in db.scalars(select(EarnedBadge).where(EarnedBadge.employee_id == eid))}
    recent = db.scalars(select(XpEvent).where(XpEvent.employee_id == eid).order_by(XpEvent.created_at.desc()).limit(8))
    week = datetime.now(timezone.utc) - timedelta(days=7)
    return {
        "xp": xp,
        "xp_week": game.total_xp(db, eid, week),
        "level": game.level_info(xp),
        "levels": [{"level": i + 1, "xp": need, "title": title} for i, (need, title) in enumerate(game.LEVELS)],
        "streak": game.streak_info(game.active_days(db, eid), None, game.off_days(db, eid)),
        "coins": game.coins(db, eid),
        "badges": [{"code": c, "title": t, "description": d, "icon": i,
                    "earned_at": earned[c].isoformat() if c in earned else None} for c, t, d, i in game.BADGES],
        "recent": [{"title": x.title, "xp": x.xp, "at": x.created_at.isoformat()} for x in recent],
    }


@router.get("/leaderboard")
def leaderboard(scope: str = "team", period: str = "all", user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    q = select(Employee)
    if scope == "team":
        q = q.where(Employee.department == user.employee.department)
    since = datetime.now(timezone.utc) - timedelta(days=7) if period == "week" else None
    return {"scope": scope, "period": period, "rows": game.leaderboard(db, list(db.scalars(q)), since, user.employee_id)}

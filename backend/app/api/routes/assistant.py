from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db import get_db
from app.models import Role, User
from app.schemas import AskIn, AskOut, EscalateIn
from app.services import assistant, hr_agent
from app.services.analytics import scope_employees, short_name
from app.services.notifications import notify, notify_role

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/ask", response_model=AskOut)
def ask(data: AskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return hr_agent.handle(db, user, data.question) or assistant.ask(data.question, user.role)


@router.get("/commands")
def commands(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    people = [] if user.role == Role.employee else [
        {"id": e.id, "name": short_name(e.full_name), "position": e.position, "department": e.department}
        for e in scope_employees(db, user) if e.id != user.employee_id]
    return {"commands": hr_agent.commands_for(user), "people": people}


@router.post("/escalate")
def escalate(data: EscalateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    e = user.employee
    notify_role(db, Role.hr, "hr_question", f"Вопрос от сотрудника: {e.full_name}",
                f"{e.position}, {e.department}. «{data.question.strip()}» Ответ: {user.email}", None)
    notify(db, user.id, "system", "Вопрос передан в HR",
           "Специалист ответит вам на рабочую почту", "/assistant")
    db.commit()
    return {"ok": True}

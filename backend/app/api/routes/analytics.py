import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db import get_db
from app.models import AuditLog, Role, User
from app.services.analytics import collect, scope_employees

router = APIRouter(prefix="/analytics", tags=["analytics"])

COLUMNS = ["ФИО", "Должность", "Отдел", "Дата приёма", "Стаж", "Остаток отпуска, дн.", "Использовано отпуска, дн.",
           "Дней без отпуска", "Авансов за 12 мес.", "Сумма авансов за 12 мес., ₸", "Курсов пройдено",
           "Курсов просрочено", "Учётная запись", "Сигналы"]


@router.get("/team.csv")
def team_csv(user: User = Depends(require_roles(Role.manager, Role.hr)), db: Session = Depends(get_db)):
    facts = [f for f in collect(db, scope_employees(db, user)) if user.role == Role.hr or f.emp.id != user.employee_id]
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(COLUMNS)
    for f in facts:
        adv = f.advances_since(365)
        w.writerow([f.emp.full_name, f.emp.position, f.emp.department, f.emp.hire_date.strftime("%d.%m.%Y"), f.tenure,
                    f.balance, f.taken_days, 0 if f.vac_now else f.days_without_vac, len(adv),
                    sum(int(r.payload["amount"]) for r in adv), len(f.completed_courses), len(f.overdue_courses),
                    f.account, "; ".join(s.text for s in f.signals)])
    db.add(AuditLog(user_id=user.id, action="export:team_csv", details=f"{len(facts)} сотрудников"))
    db.commit()
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="janahub-team-report.csv"'})

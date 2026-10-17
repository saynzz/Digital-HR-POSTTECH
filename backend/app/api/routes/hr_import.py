from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db import get_db
from app.integrations import zup_directory
from app.models import ImportRun, Role, User
from app.services import directory_sync as ds

router = APIRouter(prefix="/hr/import", tags=["hr-import"])
hr_only = require_roles(Role.hr)
MAX_BYTES = 5 * 1024 * 1024
SOURCE_LABEL = {"file": "Файл", "1c_zup": "1С:ЗУП", "1c_zup_demo": "1С:ЗУП (демо-выгрузка)"}


def _run_out(db: Session, run: ImportRun) -> dict:
    records = [ds.Record(**{**r, "errors": list(r.get("errors", []))}) for r in run.records]
    plan = ds.build_plan(db, records, run.summary.get("full_sync", False)) if not run.applied else None
    return {"id": run.id, "source": run.source, "source_label": SOURCE_LABEL.get(run.source, run.source),
            "filename": run.filename, "created_at": run.created_at.isoformat(), "applied": run.applied,
            "applied_at": run.applied_at.isoformat() if run.applied_at else None,
            "created_by": run.created_by.employee.full_name if run.created_by else None,
            "summary": plan["summary"] if plan else run.summary, "items": plan["items"] if plan else [],
            "missing": plan["missing"] if plan else [], "result": run.result}


@router.get("/template.csv")
def template(_: User = Depends(hr_only)):
    return Response(ds.template_csv(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="janahub-employees-template.csv"'})


@router.post("/preview")
async def preview(file: UploadFile = File(...), full_sync: bool = Form(False), user: User = Depends(hr_only),
                  db: Session = Depends(get_db)):
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(400, "Файл больше 5 МБ")
    try:
        records = ds.read_file(file.filename or "", content)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not records:
        raise HTTPException(400, "В файле нет строк с сотрудниками")
    run = ds.create_run(db, user, "file", file.filename, records, full_sync)
    return _run_out(db, run)


class ZupIn(BaseModel):
    full_sync: bool = False


@router.get("/zup/status")
def zup_status(_: User = Depends(hr_only)):
    if not zup_directory.configured():
        return {"configured": False, "mode": "demo", "url": None}
    try:
        n = len(zup_directory.get_source().fetch())
        return {"configured": True, "mode": "live", "url": zup_directory.get_source().url, "ok": True, "count": n}
    except Exception as e:
        return {"configured": True, "mode": "live", "url": zup_directory.get_source().url, "ok": False,
                "error": type(e).__name__}


@router.post("/zup/preview")
def zup_preview(data: ZupIn, user: User = Depends(hr_only), db: Session = Depends(get_db)):
    if zup_directory.configured():
        try:
            rows = zup_directory.get_source().fetch()
        except Exception as e:
            raise HTTPException(502, f"1С:ЗУП недоступна: {type(e).__name__}")
        source = "1c_zup"
    else:
        rows = zup_directory.demo_export(db)
        source = "1c_zup_demo"
    records = ds.to_records(rows)
    run = ds.create_run(db, user, source, None, records, data.full_sync)
    return _run_out(db, run)


@router.get("/runs")
def runs(_: User = Depends(hr_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(ImportRun).order_by(ImportRun.created_at.desc()).limit(10))
    return [{"id": r.id, "source_label": SOURCE_LABEL.get(r.source, r.source), "filename": r.filename,
             "created_at": r.created_at.isoformat(), "applied": r.applied, "summary": r.summary, "result": r.result,
             "created_by": r.created_by.employee.full_name if r.created_by else None} for r in rows]


@router.get("/runs/{run_id}")
def run_detail(run_id: int, _: User = Depends(hr_only), db: Session = Depends(get_db)):
    run = db.get(ImportRun, run_id)
    if run is None:
        raise HTTPException(404, "Импорт не найден")
    return _run_out(db, run)


class ApplyIn(BaseModel):
    send_invites: bool = True
    block_missing: bool = False
    assign_onboarding: bool = True


@router.post("/runs/{run_id}/apply")
def apply(run_id: int, data: ApplyIn, user: User = Depends(hr_only), db: Session = Depends(get_db)):
    run = db.get(ImportRun, run_id)
    if run is None:
        raise HTTPException(404, "Импорт не найден")
    try:
        ds.apply_run(db, run, user, data.send_invites, data.block_missing, data.assign_onboarding)
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.refresh(run)
    return _run_out(db, run)

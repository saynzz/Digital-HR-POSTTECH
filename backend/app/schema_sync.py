import logging

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.db import Base

log = logging.getLogger("uvicorn.error")


def outdated_tables(engine: Engine) -> list[str]:
    insp = inspect(engine)
    stale = []
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        if set(table.columns.keys()) - existing:
            stale.append(table.name)
    return stale


def ensure_schema(engine: Engine, reset_on_change: bool) -> None:
    stale = outdated_tables(engine)
    if stale:
        if not reset_on_change:
            raise RuntimeError(f"Схема БД устарела ({', '.join(stale)}). Пересоздайте базу или включите RESET_DB_ON_SCHEMA_CHANGE")
        log.warning("Схема БД устарела (%s) — демо-база пересоздаётся с тестовыми данными", ", ".join(stale))
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

import json

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Employee

CANONICAL = ["external_id", "full_name", "email", "phone", "position", "department", "manager_external_id",
             "manager_name", "hire_date", "vacation_balance_days", "role", "dismissal_date"]


def _get(row: dict, path: str):
    cur = row
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


class ZupDirectorySource:
    def __init__(self, url: str, user: str = "", password: str = "", field_map: dict | None = None,
                 timeout: float = 30.0, verify: bool = True, transport: httpx.BaseTransport | None = None):
        self.url = url
        self.auth = (user, password) if user else None
        self.field_map = field_map or {}
        self.timeout = timeout
        self.verify = verify
        self.transport = transport

    def _client(self) -> httpx.Client:
        return httpx.Client(auth=self.auth, timeout=self.timeout, verify=self.verify, transport=self.transport,
                            headers={"Accept": "application/json"})

    def fetch(self) -> list[dict]:
        with self._client() as c:
            r = c.get(self.url)
            r.raise_for_status()
            data = r.json()
        if isinstance(data, dict):
            rows = data.get("value") or data.get("employees") or []
        else:
            rows = data
        out = []
        for row in rows:
            out.append({k: _get(row, self.field_map.get(k, k)) for k in CANONICAL})
        return out


def configured() -> bool:
    return bool(settings.zup_url)


def get_source() -> ZupDirectorySource:
    fmap = json.loads(settings.zup_field_map) if settings.zup_field_map else None
    return ZupDirectorySource(settings.zup_url, settings.zup_user, settings.zup_password, fmap,
                              settings.zup_timeout, settings.zup_verify_tls)


def demo_export(db: Session) -> list[dict]:
    rows = []
    by_id = {e.id: e for e in db.scalars(select(Employee))}
    for e in by_id.values():
        mgr = by_id.get(e.manager_id)
        row = {"external_id": e.external_id, "full_name": e.full_name, "email": e.user.email if e.user else None,
               "position": e.position, "department": e.department,
               "manager_external_id": mgr.external_id if mgr else None, "hire_date": e.hire_date.isoformat(),
               "vacation_balance_days": e.vacation_balance_days}
        if e.external_id == "ZUP-0102":
            row["position"] = "Старший оператор склада"
        if e.external_id == "ZUP-0103":
            row["vacation_balance_days"] = e.vacation_balance_days + 2
        rows.append(row)
    rows += [
        {"external_id": "ZUP-0105", "full_name": "Омаров Тимур Бауржанович", "email": "timur.o@jana.demo",
         "position": "Оператор сортировочного центра", "department": "Логистика", "manager_external_id": "ZUP-0010",
         "hire_date": "2026-10-12", "vacation_balance_days": 0},
        {"external_id": "ZUP-0202", "full_name": "Ким Елена Сергеевна", "email": "elena.k@jana.demo",
         "position": "Экономист", "department": "Финансы", "manager_external_id": "ZUP-0020",
         "hire_date": "2025-04-01", "vacation_balance_days": 14},
        {"external_id": "ZUP-0301", "full_name": "Нурпеисов Арман Даулетович", "email": "arman.n@jana.demo",
         "position": "Руководитель клиентского сервиса", "department": "Клиентский сервис", "manager_external_id": None,
         "hire_date": "2021-02-15", "vacation_balance_days": 26},
        {"external_id": "ZUP-0302", "full_name": "Садыкова Айжан Маратовна", "email": "aizhan.s@jana.demo",
         "position": "Специалист контакт-центра", "department": "Клиентский сервис", "manager_external_id": "ZUP-0301",
         "hire_date": "2024-08-19", "vacation_balance_days": 9},
    ]
    return rows

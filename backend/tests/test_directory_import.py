import io

import httpx
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.integrations.zup_directory import ZupDirectorySource
from app.main import app
from app.services import directory_sync as ds

CSV = """Табельный номер;ФИО;Email;Должность;Подразделение;Табельный номер руководителя;Дата приёма;Остаток отпуска
IMP-1;Абдрахманов Саят Нурланович;sayat.imp@company.kz;Начальник склада;Склад Алматы;;01.03.2019;24
IMP-2;Иванова Ольга Петровна;olga.imp@company.kz;Кладовщик;Склад Алматы;IMP-1;15.06.2023;18
IMP-3;Без Почты Сотрудник;;Грузчик;Склад Алматы;IMP-1;10.09.2024;12
IMP-4;Ошибочный Сотрудник;bad-email;;Склад Алматы;IMP-9;32.13.2024;
ZUP-0102;Ахметов Данияр Канатович;employee2@jana.demo;Старший оператор склада;Логистика;ZUP-0010;20.02.2023;12
"""


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "demo123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def upload(client, h, name, content, full_sync=False):
    return client.post("/api/hr/import/preview", headers=h, files={"file": (name, content)},
                       data={"full_sync": str(full_sync).lower()})


def test_parse_aliases_and_errors():
    recs = ds.read_file("x.csv", CSV.encode("utf-8"))
    assert [r.external_id for r in recs][:2] == ["IMP-1", "IMP-2"]
    bad = recs[3]
    assert any("дату" in e for e in bad.errors) and any("Должность" in e for e in bad.errors)


def test_preview_and_apply_csv(client):
    hr = login(client, "hr@jana.demo")
    r = upload(client, hr, "staff.csv", CSV.encode("cp1251"))
    assert r.status_code == 200, r.text
    run = r.json()
    s = run["summary"]
    assert s["create"] == 3 and s["update"] == 1 and s["error"] == 1 and s["no_email"] == 1
    upd = next(i for i in run["items"] if i["external_id"] == "ZUP-0102")
    assert upd["changes"][0]["to"] == "Старший оператор склада"
    boss = next(i for i in run["items"] if i["external_id"] == "IMP-1")
    assert boss["role"] == "manager" and boss["account"] == "invite"
    done = client.post(f"/api/hr/import/runs/{run['id']}/apply", headers=hr, json={"send_invites": True}).json()
    assert done["applied"] and len(done["result"]["created"]) == 3 and len(done["result"]["invited"]) == 2
    assert client.post(f"/api/hr/import/runs/{run['id']}/apply", headers=hr, json={}).status_code == 400
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    olga = next(a for a in accounts if a["email"] == "olga.imp@company.kz")
    assert olga["status"] == "invited"


def test_xlsx_and_dismissal_blocks_account(client):
    hr = login(client, "hr@jana.demo")
    wb = Workbook()
    ws = wb.active
    ws.append(["Выгрузка из 1С:ЗУП"])
    ws.append(["Таб. №", "Сотрудник", "Должность", "Отдел", "Дата приема", "Дата увольнения"])
    ws.append(["IMP-2", "Иванова Ольга Петровна", "Кладовщик", "Склад Алматы", "15.06.2023", "01.10.2026"])
    buf = io.BytesIO()
    wb.save(buf)
    run = upload(client, hr, "zup.xlsx", buf.getvalue()).json()
    assert run["summary"]["dismiss"] == 1
    client.post(f"/api/hr/import/runs/{run['id']}/apply", headers=hr, json={})
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    assert next(a for a in accounts if a["email"] == "olga.imp@company.kz")["status"] == "blocked"


def test_full_sync_reports_missing_and_rights(client):
    hr = login(client, "hr@jana.demo")
    run = upload(client, hr, "one.csv", "Табельный номер;ФИО;Должность;Подразделение;Дата приёма\nIMP-1;Абдрахманов Саят Нурланович;Начальник склада;Склад Алматы;01.03.2019\n".encode(), True).json()
    assert run["summary"]["missing"] > 0
    assert all(m["external_id"] != "ZUP-0001" for m in run["missing"])
    assert upload(client, login(client, "manager@jana.demo"), "a.csv", b"x").status_code == 403
    assert upload(client, hr, "a.pdf", b"x").status_code == 400


def test_zup_demo_sync(client):
    hr = login(client, "hr@jana.demo")
    assert client.get("/api/hr/import/zup/status", headers=hr).json()["mode"] == "demo"
    run = client.post("/api/hr/import/zup/preview", headers=hr, json={}).json()
    assert run["source"] == "1c_zup_demo" and run["summary"]["create"] == 4


def test_zup_source_odata_mapping():
    payload = {"value": [{"Code": "Z-1", "Description": "Тест Тестов", "Должность": {"Description": "Курьер"},
                          "Подразделение": {"Description": "Доставка"}, "ДатаПриема": "2024-01-10T00:00:00"}]}
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json=payload))
    src = ZupDirectorySource("http://1c/odata", field_map={"external_id": "Code", "full_name": "Description",
                                                           "position": "Должность.Description",
                                                           "department": "Подразделение.Description",
                                                           "hire_date": "ДатаПриема"}, transport=transport)
    recs = ds.to_records(src.fetch())
    assert recs[0].position == "Курьер" and recs[0].hire_date == "2024-01-10" and not recs[0].errors

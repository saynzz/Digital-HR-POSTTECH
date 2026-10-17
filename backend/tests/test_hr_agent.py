import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/agent.db"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "demo123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def ask(client, h, q):
    r = client.post("/api/assistant/ask", json={"question": q}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def block(res, kind):
    return [b for b in res["report"]["blocks"] if b["type"] == kind]


def test_manager_team_report_only_own_department(client):
    h = login(client, "manager@jana.demo")
    res = ask(client, h, "/команда")
    assert res["mode"] == "analytics"
    names = {r["cells"][0]["text"] for r in block(res, "table")[0]["rows"]}
    assert "Ахметов Данияр" in names and "Сейткали Нурбол" in names
    assert "Жумабаева Мадина" not in names and "Касымов Ерлан" not in names


def test_manager_cannot_open_other_department(client):
    h = login(client, "manager@jana.demo")
    res = ask(client, h, "/сотрудник Жумабаева")
    assert res["report"] is None
    assert "нет в вашей команде" in res["answer"]


def test_profile_history_since_hire(client):
    h = login(client, "manager@jana.demo")
    res = ask(client, h, "покажи досье Сейткали")
    assert res["report"]["title"] == "Досье: Сейткали Нурбол"
    person = block(res, "person")[0]
    assert person["hire_date"] == "2020-04-13"
    years = [i["label"] for i in block(res, "bars")[0]["items"]]
    assert years[0] == "2020"
    codes = {s["code"] for s in block(res, "signals")[0]["items"]}
    assert {"big_balance", "stale_request", "no_vacation"} <= codes
    timeline = block(res, "timeline")[0]["items"]
    assert any("Принят" in t["title"] for t in timeline)


def test_natural_language_vacations_and_overlap(client):
    h = login(client, "manager@jana.demo")
    res = ask(client, h, "Кто давно не был в отпуске?")
    gantt = block(res, "gantt")[0]
    assert gantt["overlaps"] and set(gantt["overlaps"][0]["names"]) == {"Нурланова Алия", "Сейткали Нурбол"}


def test_kb_questions_still_go_to_knowledge_base(client):
    h = login(client, "manager@jana.demo")
    assert ask(client, h, "Как оформить отпуск?")["mode"] in ("extractive", "llm")


def test_hr_only_commands(client):
    assert "только HR" in ask(client, login(client, "manager@jana.demo"), "/отделы")["answer"]
    hr = login(client, "hr@jana.demo")
    deps = ask(client, hr, "/отделы")
    assert len(block(deps, "table")[0]["rows"]) >= 3
    onboarding = ask(client, hr, "/найм")
    assert any("Ли Анастасия" in r["cells"][0]["text"] for r in block(onboarding, "table")[0]["rows"])


def test_employee_restrictions(client):
    h = login(client, "employee@jana.demo")
    assert "руководителям и HR" in ask(client, h, "/команда")["answer"]
    assert ask(client, h, "покажи Ахметова")["mode"] == "refusal"
    me = ask(client, h, "/я")
    assert block(me, "person")[0]["name"] == "Нурланова Алия"
    assert not block(me, "signals")


def test_audit_and_csv(client):
    m = login(client, "manager@jana.demo")
    r = client.get("/api/analytics/team.csv", headers=m)
    assert r.status_code == 200 and "Сейткали Нурбол" in r.text and "Жумабаева" not in r.text
    assert client.get("/api/analytics/team.csv", headers=login(client, "employee@jana.demo")).status_code == 403
    journal = ask(client, login(client, "hr@jana.demo"), "/журнал")
    actions = {r["cells"][2]["text"] for r in block(journal, "table")[0]["rows"]}
    assert "выгрузка отчёта CSV" in actions and "отказ: нет доступа" in actions


def test_commands_list(client):
    m = client.get("/api/assistant/commands", headers=login(client, "manager@jana.demo")).json()
    assert "/команда" in {c["cmd"] for c in m["commands"]} and "/отделы" not in {c["cmd"] for c in m["commands"]}
    assert {p["department"] for p in m["people"]} == {"Логистика"}
    e = client.get("/api/assistant/commands", headers=login(client, "employee@jana.demo")).json()
    assert e["people"] == [] and {c["cmd"] for c in e["commands"]} == {"/я", "/помощь"}

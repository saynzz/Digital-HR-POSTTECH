import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "demo123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_login_and_profile(client):
    h = login(client, "employee@jana.demo")
    me = client.get("/api/auth/me", headers=h).json()
    assert me["role"] == "employee"
    assert me["employee"]["manager"]["full_name"].startswith("Касымов")


def test_unauthorized(client):
    assert client.get("/api/auth/me").status_code == 401


def test_employee_cannot_see_others(client):
    h = login(client, "employee@jana.demo")
    me = client.get("/api/auth/me", headers=h).json()
    other_ids = [i for i in range(1, 7) if i != me["employee"]["id"]]
    for i in other_ids:
        assert client.get(f"/api/employees/{i}", headers=h).status_code == 403
    assert client.get("/api/team", headers=h).status_code == 403
    assert client.get("/api/requests?scope=all", headers=h).status_code == 403


def test_manager_sees_only_own_team(client):
    h = login(client, "manager@jana.demo")
    team = client.get("/api/team", headers=h).json()
    assert {e["department"] for e in team} == {"Логистика"}
    reqs = client.get("/api/requests?scope=team", headers=h).json()
    assert all(r["employee"]["department"] == "Логистика" for r in reqs)
    hr = login(client, "hr@jana.demo")
    foreign = [r for r in client.get("/api/requests?scope=all", headers=hr).json()
               if r["employee"]["department"] == "Финансы"]
    assert client.get(f"/api/requests/{foreign[0]['id']}", headers=h).status_code == 403


def test_vacation_end_to_end(client):
    emp, mgr, hr = (login(client, e) for e in ("employee@jana.demo", "manager@jana.demo", "hr@jana.demo"))
    balance = client.get("/api/auth/me", headers=emp).json()["employee"]["vacation_balance_days"]
    r = client.post("/api/requests", headers=emp, json={
        "type": "vacation", "vacation": {"start_date": "2027-03-01", "end_date": "2027-03-03"}})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "pending_manager"

    assert client.post(f"/api/requests/{rid}/decision", headers=hr, json={"decision": "approve"}).status_code == 403
    assert client.post(f"/api/requests/{rid}/decision", headers=mgr,
                       json={"decision": "approve"}).json()["status"] == "pending_hr"
    done = client.post(f"/api/requests/{rid}/decision", headers=hr, json={"decision": "approve"}).json()
    assert done["status"] == "approved" and done["external_doc_id"].startswith("DOC-")
    assert len(done["events"]) == 3

    new_balance = client.get("/api/auth/me", headers=emp).json()["employee"]["vacation_balance_days"]
    assert new_balance == balance - 3
    notes = client.get("/api/notifications", headers=emp).json()
    assert any(f"№{rid}" in (n["body"] or "") and "Оформлено" in n["title"] for n in notes)


def test_vacation_over_balance_rejected(client):
    emp = login(client, "employee@jana.demo")
    r = client.post("/api/requests", headers=emp, json={
        "type": "vacation", "vacation": {"start_date": "2027-05-01", "end_date": "2027-07-01"}})
    assert r.status_code == 400


def test_academy_progress(client):
    emp = login(client, "employee@jana.demo")
    enr = client.get("/api/academy/my", headers=emp).json()[0]
    course = client.get(f"/api/academy/courses/{enr['course']['id']}", headers=emp).json()
    assert "correct_index" not in course["questions"][0]
    lid = course["lessons"][0]["id"]
    after = client.post(f"/api/academy/courses/{course['id']}/lessons/{lid}/complete", headers=emp).json()
    assert after["progress"] > 0 and after["status"] == "in_progress"


def test_assistant_answers_with_source(client):
    emp = login(client, "employee@jana.demo")
    r = client.post("/api/assistant/ask", headers=emp, json={"question": "Как оформить отпуск?"}).json()
    assert r["found"] and r["sources"][0]["doc_id"] == "vacation"


def test_assistant_refuses_unknown(client):
    emp = login(client, "employee@jana.demo")
    r = client.post("/api/assistant/ask", headers=emp, json={"question": "Какой курс биткоина завтра?"}).json()
    assert not r["found"] and r["sources"] == []


def test_assistant_respects_roles(client):
    emp = login(client, "employee@jana.demo")
    r = client.post("/api/assistant/ask", headers=emp,
                    json={"question": "Как руководителю согласовать заявки подчинённых?"}).json()
    assert all(s["doc_id"] != "manager_guide" for s in r["sources"])


def test_request_history_has_actor_names(client):
    emp = login(client, "employee@jana.demo")
    first = client.get("/api/requests?scope=my", headers=emp).json()[-1]
    detail = client.get(f"/api/requests/{first['id']}", headers=emp).json()
    assert any(ev["actor_name"] and "Касымов" in ev["actor_name"] for ev in detail["events"])


def test_escalate_question_to_hr(client):
    emp = login(client, "employee2@jana.demo")
    hr = login(client, "hr@jana.demo")
    r = client.post("/api/assistant/escalate", headers=emp, json={"question": "Положена ли мне компенсация за обед?"})
    assert r.status_code == 200
    notes = client.get("/api/notifications", headers=hr).json()
    assert any("компенсация за обед" in (n["body"] or "") for n in notes)
    mine = client.get("/api/notifications", headers=emp).json()
    assert mine[0]["title"] == "Вопрос передан в HR"

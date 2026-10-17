from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.gamification import streak_info


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "demo123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_fair_streak_skips_weekends_vacation_and_freezes_once_a_week():
    fri = date(2026, 10, 16)
    mon = fri + timedelta(days=3)
    assert streak_info({fri}, mon)["current"] == 1
    assert streak_info({date(2026, 10, 13), date(2026, 10, 14), fri}, date(2026, 10, 17))["current"] == 3
    assert streak_info({date(2026, 10, 12), date(2026, 10, 14), fri}, date(2026, 10, 17))["current"] == 2
    vacation = {date(2026, 10, 19) + timedelta(days=i) for i in range(5)}
    assert streak_info({fri}, date(2026, 10, 24), vacation)["current"] == 1


def test_redeem_reward_and_refund_on_reject(client):
    h = login(client, "employee2@jana.demo")
    before = client.get("/api/motivation/summary", headers=h).json()["coins"]
    cheap = client.get("/api/motivation/rewards", headers=h).json()[0]
    r = client.post(f"/api/motivation/rewards/{cheap['id']}/redeem", headers=h)
    assert r.status_code == 201
    assert client.get("/api/motivation/summary", headers=h).json()["coins"] == before - cheap["cost"]
    hr = login(client, "hr@jana.demo")
    client.post(f"/api/motivation/admin/redemptions/{r.json()['id']}/decide", headers=hr, json={"approve": False, "comment": "Нет в наличии"})
    assert client.get("/api/motivation/summary", headers=h).json()["coins"] == before
    expensive = client.get("/api/motivation/rewards", headers=h).json()[-1]
    assert client.post(f"/api/motivation/rewards/{expensive['id']}/redeem", headers=h).status_code == 400
    assert client.get("/api/motivation/admin/redemptions", headers=h).status_code == 403


def test_kudos_limit_xp_and_badge(client):
    h = login(client, "manager@jana.demo")
    people = client.get("/api/motivation/colleagues", headers=h).json()
    target = next(p for p in people if p["name"].startswith("Ли"))
    left = client.get("/api/motivation/summary", headers=h).json()["kudos_left"]
    for _ in range(left):
        r = client.post("/api/motivation/kudos", headers=h, json={"to_employee_id": target["id"], "value": "result", "message": "Отличная работа!"})
        assert r.status_code == 201
    r = client.post("/api/motivation/kudos", headers=h, json={"to_employee_id": target["id"], "value": "open", "message": "Ещё раз спасибо"})
    assert r.status_code == 400
    me = client.get("/api/auth/me", headers=h).json()
    assert client.post("/api/motivation/kudos", headers=h, json={"to_employee_id": me["employee"]["id"], "value": "open", "message": "Себе"}).status_code == 400
    feed = client.get("/api/motivation/kudos", headers=h).json()
    assert feed[0]["to"]["name"].startswith("Ли") and feed[0]["sent_by_me"]


def test_team_goal_scope(client):
    m = login(client, "manager@jana.demo")
    goals = client.get("/api/motivation/goals", headers=m).json()
    assert [g["department"] for g in goals] == ["Логистика"] and goals[0]["goal"]["percent"] > 0
    r = client.post("/api/motivation/goals", headers=m, json={"department": "Финансы", "title": "Новая цель", "reward": "Торт",
                                                              "target_xp": 300, "end_date": (date.today() + timedelta(days=20)).isoformat()})
    assert r.status_code == 201 and r.json()["department"] == "Логистика"
    assert client.get("/api/motivation/goals", headers=login(client, "employee@jana.demo")).status_code == 403

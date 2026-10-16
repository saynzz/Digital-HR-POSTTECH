from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.gamification import level_info, streak_info


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "demo123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_levels_and_streak_math():
    assert level_info(0)["title"] == "Стажёр"
    assert level_info(260)["level"] == 3 and level_info(260)["xp_to"] == 500
    assert level_info(5000)["progress"] == 100
    d = date(2026, 10, 16)
    st = streak_info({date(2026, 10, 13), date(2026, 10, 14), date(2026, 10, 15)}, d)
    assert st["current"] == 3 and not st["today"]
    assert streak_info({date(2026, 10, 10)}, d)["current"] == 0


def test_game_profile_and_tracks(client):
    h = login(client, "employee@jana.demo")
    g = client.get("/api/academy/game", headers=h).json()
    assert g["xp"] > 0 and g["streak"]["current"] >= 3
    assert any(b["code"] == "streak3" and b["earned_at"] for b in g["badges"])
    tracks = client.get("/api/academy/tracks", headers=h).json()
    onboarding = next(t for t in tracks if t["slug"] == "onboarding")
    assert onboarding["enrolled"] and onboarding["steps"][2]["locked"]


def test_xp_is_awarded_once_and_track_completes(client):
    h = login(client, "employee2@jana.demo")
    tracks = client.get("/api/academy/tracks", headers=h).json()
    onboarding = next(t for t in tracks if t["slug"] == "logistics")
    total_bonus = 0
    for step in onboarding["steps"]:
        if step["status"] == "completed":
            continue
        cd = client.get(f"/api/academy/courses/{step['course']['id']}", headers=h).json()
        first = None
        for lesson in cd["lessons"]:
            r = client.post(f"/api/academy/courses/{cd['id']}/lessons/{lesson['id']}/complete", headers=h).json()
            first = first or r
        again = client.post(f"/api/academy/courses/{cd['id']}/lessons/{cd['lessons'][0]['id']}/complete", headers=h).json()
        assert again["rewards"] is None
        answers = {str(q["id"]): 1 for q in cd["questions"]}
        r = client.post(f"/api/academy/courses/{cd['id']}/quiz", headers=h, json={"answers": answers}).json()
        if r["status"] == "completed" and r["rewards"]:
            total_bonus += sum(i["xp"] for i in r["rewards"]["items"] if "Траектория" in i["label"])
    done = next(t for t in client.get("/api/academy/tracks", headers=h).json() if t["slug"] == "logistics")
    assert done["progress"]["complete"]
    assert done["completed_at"] and total_bonus == 200
    g = client.get("/api/academy/game", headers=h).json()
    assert any(b["code"] == "track" and b["earned_at"] for b in g["badges"])


def test_leaderboard_scopes(client):
    h = login(client, "employee@jana.demo")
    team = client.get("/api/academy/leaderboard?scope=team&period=week", headers=h).json()["rows"]
    assert {r["department"] for r in team} == {"Логистика"} and sum(r["me"] for r in team) == 1
    company = client.get("/api/academy/leaderboard?scope=company", headers=h).json()["rows"]
    assert len(company) >= len(team) and company[0]["rank"] == 1


def test_manager_assigns_track(client):
    m = login(client, "manager@jana.demo")
    team = client.get("/api/team", headers=m).json()
    dan = next(e for e in team if e["full_name"].startswith("Ахметов"))
    leader = next(t for t in client.get("/api/academy/tracks", headers=m).json() if t["slug"] == "leader")
    r = client.post("/api/academy/tracks/assign", headers=m, json={"employee_id": dan["id"], "track_id": leader["id"]})
    assert r.status_code == 201
    fin = login(client, "finance@jana.demo")
    assert client.post("/api/academy/tracks/assign", headers=fin,
                       json={"employee_id": dan["id"], "track_id": leader["id"]}).status_code == 403

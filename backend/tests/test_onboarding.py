import os
import tempfile
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.integrations.mock_mail import MockMailAdapter
from app.main import app
from app.models import InviteToken


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password="demo123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def token_from(url):
    return parse_qs(urlparse(url).query)["token"][0]


def new_candidate(client, hr, email, **extra):
    body = {"full_name": "Тестов Тест Тестович", "email": email, "position": "Курьер",
            "department": "Логистика", **extra}
    r = client.post("/api/hr/candidates", headers=hr, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_only_hr_manages_candidates(client):
    for email in ("employee@jana.demo", "manager@jana.demo"):
        h = login(client, email)
        assert client.get("/api/hr/candidates", headers=h).status_code == 403
        assert client.post("/api/hr/candidates", headers=h, json={
            "full_name": "Х Х Х", "email": "x@jana.demo", "position": "x", "department": "xx"}).status_code == 403
        assert client.get("/api/hr/accounts", headers=h).status_code == 403


def test_seed_candidates_and_filter(client):
    hr = login(client, "hr@jana.demo")
    all_ = client.get("/api/hr/candidates", headers=hr).json()
    assert {c["status"] for c in all_} >= {"interview_pending", "interview_passed", "interview_failed"}
    passed = client.get("/api/hr/candidates?status=interview_passed", headers=hr).json()
    assert passed and all(c["status"] == "interview_passed" for c in passed)


def test_duplicate_email_rejected(client):
    hr = login(client, "hr@jana.demo")
    r = client.post("/api/hr/candidates", headers=hr, json={
        "full_name": "Дубль Дубль", "email": "employee@jana.demo", "position": "Курьер", "department": "Логистика"})
    assert r.status_code == 400


def test_status_flow_and_archive(client):
    hr = login(client, "hr@jana.demo")
    c = new_candidate(client, hr, "flow@jana.demo")
    assert c["status"] == "interview_pending"
    cid = c["id"]
    assert client.post(f"/api/hr/candidates/{cid}/hire", headers=hr,
                       json={"start_date": "2027-01-10"}).status_code == 400
    r = client.post(f"/api/hr/candidates/{cid}/status", headers=hr,
                    json={"status": "interview_failed", "comment": "Не подошёл"}).json()
    assert r["status"] == "interview_failed" and r["status_comment"] == "Не подошёл"
    assert client.post(f"/api/hr/candidates/{cid}/archive", headers=hr, json={}).json()["status"] == "archived"
    assert client.patch(f"/api/hr/candidates/{cid}", headers=hr, json={"position": "Другое"}).status_code == 400
    assert client.post(f"/api/hr/candidates/{cid}/restore", headers=hr).json()["status"] == "interview_pending"


def test_hire_invite_activate_end_to_end(client):
    hr = login(client, "hr@jana.demo")
    mgr = login(client, "manager@jana.demo")
    c = new_candidate(client, hr, "new.hire@jana.demo", manager_id=2)
    client.post(f"/api/hr/candidates/{c['id']}/status", headers=hr, json={"status": "interview_passed"})

    r = client.post(f"/api/hr/candidates/{c['id']}/hire", headers=hr, json={"start_date": "2027-01-10"})
    assert r.status_code == 200, r.text
    hired = r.json()
    assert hired["candidate"]["status"] == "hired" and hired["sent_to"] == "new.hire@jana.demo"
    assert MockMailAdapter.outbox[-1].to == "new.hire@jana.demo"
    token = token_from(hired["invite_url"])

    r = client.post("/api/auth/login", json={"email": "new.hire@jana.demo", "password": "whatever1"})
    assert r.status_code == 401 and "не активирован" in r.json()["detail"]

    info = client.get(f"/api/auth/invite/{token}").json()
    assert info["full_name"] == "Тестов Тест Тестович" and info["is_reset"] is False

    assert client.post("/api/auth/activate", json={"token": token, "password": "short"}).status_code == 400
    r = client.post("/api/auth/activate", json={"token": token, "password": "NewPass123"})
    assert r.status_code == 200
    me_h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    me = client.get("/api/auth/me", headers=me_h).json()
    assert me["role"] == "employee" and me["employee"]["manager"]["id"] == 2

    assert client.post("/api/auth/activate", json={"token": token, "password": "Another123"}).status_code == 400
    assert client.get(f"/api/auth/invite/{token}").status_code == 400

    login(client, "new.hire@jana.demo", "NewPass123")
    courses = client.get("/api/academy/my", headers=me_h).json()
    assert any(e["course"]["title"] == "Добро пожаловать в Jana Post" for e in courses)
    assert any(e["id"] == me["employee"]["id"] for e in client.get("/api/team", headers=mgr).json())


def test_resend_revokes_previous_link_and_expiry(client):
    hr = login(client, "hr@jana.demo")
    c = new_candidate(client, hr, "resend@jana.demo")
    client.post(f"/api/hr/candidates/{c['id']}/status", headers=hr, json={"status": "interview_passed"})
    hired = client.post(f"/api/hr/candidates/{c['id']}/hire", headers=hr, json={"start_date": "2027-02-01"}).json()
    old = token_from(hired["invite_url"])
    new = token_from(client.post(f"/api/hr/accounts/{hired['user_id']}/invite", headers=hr).json()["invite_url"])
    assert client.get(f"/api/auth/invite/{old}").status_code == 400
    assert client.get(f"/api/auth/invite/{new}").status_code == 200

    db = SessionLocal()
    t = db.query(InviteToken).filter(InviteToken.user_id == hired["user_id"], InviteToken.revoked_at.is_(None)).one()
    t.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    db.close()
    assert client.get(f"/api/auth/invite/{new}").status_code == 400


def test_token_stored_as_hash(client):
    hr = login(client, "hr@jana.demo")
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    uid = next(a["user_id"] for a in accounts if a["email"] == "employee2@jana.demo")
    raw = token_from(client.post(f"/api/hr/accounts/{uid}/invite", headers=hr).json()["invite_url"])
    db = SessionLocal()
    assert db.query(InviteToken).filter(InviteToken.token_hash == raw).count() == 0
    db.close()


def test_block_and_unblock(client):
    hr = login(client, "hr@jana.demo")
    emp = login(client, "madina@jana.demo")
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    uid = next(a["user_id"] for a in accounts if a["email"] == "madina@jana.demo")
    me_id = next(a["user_id"] for a in accounts if a["email"] == "hr@jana.demo")

    assert client.post(f"/api/hr/accounts/{me_id}/block", headers=hr).status_code == 400
    assert client.post(f"/api/hr/accounts/{uid}/block", headers=hr).json()["status"] == "blocked"
    assert client.get("/api/auth/me", headers=emp).status_code == 401
    assert client.post("/api/auth/login", json={"email": "madina@jana.demo", "password": "demo123"}).status_code == 403
    assert client.post(f"/api/hr/accounts/{uid}/invite", headers=hr).status_code == 400
    assert client.post(f"/api/hr/accounts/{uid}/unblock", headers=hr).json()["status"] == "active"
    login(client, "madina@jana.demo")


def test_password_reset_for_active_user(client):
    hr = login(client, "hr@jana.demo")
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    uid = next(a["user_id"] for a in accounts if a["email"] == "finance@jana.demo")
    raw = token_from(client.post(f"/api/hr/accounts/{uid}/invite", headers=hr).json()["invite_url"])
    assert client.get(f"/api/auth/invite/{raw}").json()["is_reset"] is True
    assert client.post("/api/auth/activate", json={"token": raw, "password": "Reset2027"}).status_code == 200
    login(client, "finance@jana.demo", "Reset2027")


def test_failed_email_returns_link_as_fallback(client, monkeypatch):
    from app.integrations.smtp_mail import MailDeliveryError
    from app.services import onboarding

    class Broken:
        def send(self, **kw):
            raise MailDeliveryError("Почтовый сервер отклонил вход")

    monkeypatch.setattr(onboarding, "get_mailer", lambda: Broken())
    monkeypatch.setattr(onboarding.settings, "expose_invite_links", False)
    hr = login(client, "hr@jana.demo")
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    uid = next(a["user_id"] for a in accounts if a["email"] == "employee@jana.demo")
    r = client.post(f"/api/hr/accounts/{uid}/invite", headers=hr).json()
    assert r["email_sent"] is False and "отклонил" in r["email_error"] and r["invite_url"]


def test_successful_email_hides_link_when_not_exposed(client, monkeypatch):
    from app.services import onboarding

    sent = []

    class Ok:
        def send(self, **kw):
            sent.append(kw)

    monkeypatch.setattr(onboarding, "get_mailer", lambda: Ok())
    monkeypatch.setattr(onboarding.settings, "expose_invite_links", False)
    hr = login(client, "hr@jana.demo")
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    uid = next(a["user_id"] for a in accounts if a["email"] == "employee2@jana.demo")
    r = client.post(f"/api/hr/accounts/{uid}/invite", headers=hr).json()
    assert r["email_sent"] is True and r["invite_url"] is None
    assert sent[-1]["to"] == "employee2@jana.demo" and "activate?token=" in sent[-1]["html"]


def test_mock_mode_is_reported_honestly(client):
    hr = login(client, "hr@jana.demo")
    accounts = client.get("/api/hr/accounts", headers=hr).json()
    uid = next(a["user_id"] for a in accounts if a["email"] == "employee@jana.demo")
    r = client.post(f"/api/hr/accounts/{uid}/invite", headers=hr).json()
    assert r["email_sent"] is False and "SMTP_USER" in r["email_error"] and r["invite_url"]
    assert MockMailAdapter.outbox[-1].to == "employee@jana.demo"

import smtplib

import pytest

from app.integrations.smtp_mail import MailDeliveryError, SMTPMailAdapter
from app.services.mail_templates import invite_email


class FakeSMTP:
    instances: list["FakeSMTP"] = []
    fail_login = False

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port, self.calls, self.sent = host, port, [], []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.calls.append("quit")

    def starttls(self, context=None):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user, password))
        if FakeSMTP.fail_login:
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")

    def send_message(self, msg):
        self.sent.append(msg)


@pytest.fixture(autouse=True)
def fake_smtp(monkeypatch):
    FakeSMTP.instances, FakeSMTP.fail_login = [], False
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)


def adapter(**kw):
    return SMTPMailAdapter(host="smtp.gmail.com", port=587, user="team@gmail.com",
                           password="abcd efgh ijkl mnop", sender="", sender_name="Jana Hub", **kw)


def test_gmail_starttls_login_and_html():
    subject, text, html = invite_email("Ибраева Жанна Маратовна", "Менеджер", "http://x/activate?token=t", True, 72)
    adapter().send("zhanna@example.com", subject, text, html)
    s = FakeSMTP.instances[0]
    assert (s.host, s.port) == ("smtp.gmail.com", 587)
    assert s.calls[0] == "starttls"
    assert s.calls[1] == ("login", "team@gmail.com", "abcdefghijklmnop")
    msg = s.sent[0]
    assert msg["To"] == "zhanna@example.com" and "team@gmail.com" in msg["From"]
    assert msg.is_multipart()
    html_part = msg.get_body(preferencelist=("html",)).get_content()
    assert "http://x/activate?token=t" in html_part and "Жанна" in html_part


def test_auth_error_is_readable():
    FakeSMTP.fail_login = True
    with pytest.raises(MailDeliveryError, match="пароль приложения"):
        adapter().send("a@example.com", "s", "b")


def test_not_configured():
    a = SMTPMailAdapter(host="smtp.gmail.com", port=587, user="", password="", sender="", sender_name="J")
    with pytest.raises(MailDeliveryError, match="SMTP_USER"):
        a.send("a@example.com", "s", "b")


def test_template_escapes_html():
    _, _, html = invite_email("Тест <script> Имя", "Курьер", "http://x/?token=a&b", True, 72)
    assert "<script>" not in html and "&amp;b" in html


def test_auto_mode(monkeypatch):
    from app import integrations
    from app.integrations.mock_mail import MockMailAdapter

    monkeypatch.setattr(integrations.settings, "mail_provider", "auto")
    monkeypatch.setattr(integrations.settings, "smtp_user", "")
    monkeypatch.setattr(integrations.settings, "smtp_password", "")
    assert isinstance(integrations.get_mailer(), MockMailAdapter)
    monkeypatch.setattr(integrations.settings, "smtp_user", "team@gmail.com")
    monkeypatch.setattr(integrations.settings, "smtp_password", "abcd efgh ijkl mnop")
    assert isinstance(integrations.get_mailer(), SMTPMailAdapter)
    monkeypatch.setattr(integrations.settings, "mail_provider", "mock")
    assert isinstance(integrations.get_mailer(), MockMailAdapter)

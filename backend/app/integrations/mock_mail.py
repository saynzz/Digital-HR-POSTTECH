import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

log = logging.getLogger("mail")


@dataclass
class SentMail:
    to: str
    subject: str
    body: str
    html: str | None = None
    sent_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class MockMailAdapter:
    outbox: list[SentMail] = []

    def send(self, to: str, subject: str, body: str, html: str | None = None) -> None:
        self.outbox.append(SentMail(to, subject, body, html))
        log.info("Письмо (демо, не отправлено) → %s: %s", to, subject)

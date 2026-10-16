from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, Role, User


def notify(db: Session, user_id: int, type: str, title: str, body: str | None = None, link: str | None = None) -> None:
    db.add(Notification(user_id=user_id, type=type, title=title, body=body, link=link))


def notify_role(db: Session, role: Role, type: str, title: str, body: str | None = None, link: str | None = None) -> None:
    for uid in db.scalars(select(User.id).where(User.role == role)):
        notify(db, uid, type, title, body, link)

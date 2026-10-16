from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.base import DocumentFlowAdapter, HRSystemAdapter, MailAdapter
from app.integrations.mock_1c_zup import Mock1CZupAdapter
from app.integrations.mock_documentolog import MockDocumentologAdapter
from app.integrations.mock_mail import MockMailAdapter
from app.integrations.smtp_mail import SMTPMailAdapter


def get_hr_system(db: Session) -> HRSystemAdapter:
    if settings.hr_system_provider == "mock":
        return Mock1CZupAdapter(db)
    raise NotImplementedError("Реальный адаптер 1С:ЗУП подключается здесь")


def get_docflow() -> DocumentFlowAdapter:
    if settings.docflow_provider == "mock":
        return MockDocumentologAdapter()
    raise NotImplementedError("Реальный адаптер Documentolog подключается здесь")


def mail_mode() -> str:
    provider = settings.mail_provider.strip().lower()
    if provider == "auto":
        return "smtp" if settings.smtp_user and settings.smtp_password else "mock"
    return "smtp" if provider == "smtp" else "mock"


def get_mailer() -> MailAdapter:
    if mail_mode() == "smtp":
        return SMTPMailAdapter(
            host=settings.smtp_host, port=settings.smtp_port, user=settings.smtp_user,
            password=settings.smtp_password, sender=settings.mail_from or settings.smtp_user,
            sender_name=settings.mail_from_name, use_ssl=settings.smtp_ssl,
        )
    return MockMailAdapter()

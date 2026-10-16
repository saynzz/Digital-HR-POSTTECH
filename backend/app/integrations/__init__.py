from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.base import DocumentFlowAdapter, HRSystemAdapter
from app.integrations.mock_1c_zup import Mock1CZupAdapter
from app.integrations.mock_documentolog import MockDocumentologAdapter


def get_hr_system(db: Session) -> HRSystemAdapter:
    if settings.hr_system_provider == "mock":
        return Mock1CZupAdapter(db)
    raise NotImplementedError("Реальный адаптер 1С:ЗУП подключается здесь")


def get_docflow() -> DocumentFlowAdapter:
    if settings.docflow_provider == "mock":
        return MockDocumentologAdapter()
    raise NotImplementedError("Реальный адаптер Documentolog подключается здесь")

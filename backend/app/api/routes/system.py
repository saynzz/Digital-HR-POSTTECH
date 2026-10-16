from fastapi import APIRouter

from app.core.config import settings
from app.integrations import mail_mode
from app.services.llm import get_llm

router = APIRouter(tags=["system"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/integrations")
def integrations():
    llm = get_llm()
    return {
        "1c_zup": {"provider": settings.hr_system_provider, "purpose": "кадровые данные, остатки отпуска, приказы"},
        "documentolog": {"provider": settings.docflow_provider, "purpose": "регистрация заявлений и приказов"},
        "mail": {
            "mode": mail_mode(),
            "smtp_host": settings.smtp_host if mail_mode() == "smtp" else None,
            "sender": f"***@{settings.smtp_user.split('@')[-1]}" if settings.smtp_user else None,
        },
        "llm": {
            "provider": settings.llm_provider,
            "model": llm.model if llm else None,
            **(llm.health() if llm else {"status": "disabled"}),
        },
    }

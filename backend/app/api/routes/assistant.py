from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models import User
from app.schemas import AskIn, AskOut
from app.services import assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/ask", response_model=AskOut)
def ask(data: AskIn, user: User = Depends(get_current_user)):
    return assistant.ask(data.question, user.role)

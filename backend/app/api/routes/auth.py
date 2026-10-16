from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.db import get_db
from app.models import AccountStatus, User
from app.schemas import ActivateIn, InviteInfoOut, LoginIn, MeOut, TokenOut
from app.services import onboarding

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID = "Неверный email или пароль"


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == data.email.lower().strip()))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID)
    if user.status == AccountStatus.invited or not user.password_hash:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            "Аккаунт ещё не активирован. Откройте ссылку из письма-приглашения или обратитесь в HR")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID)
    if user.status == AccountStatus.blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступ заблокирован. Обратитесь в HR")
    return TokenOut(access_token=create_access_token(user.id, user.role.value))


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(id=user.id, email=user.email, role=user.role, locale=user.locale, employee=user.employee)


@router.get("/invite/{token}", response_model=InviteInfoOut)
def invite_info(token: str, db: Session = Depends(get_db)):
    return onboarding.invite_info(db, token)


@router.post("/activate", response_model=TokenOut)
def activate(data: ActivateIn, db: Session = Depends(get_db)):
    user = onboarding.activate(db, data.token, data.password)
    return TokenOut(access_token=create_access_token(user.id, user.role.value))

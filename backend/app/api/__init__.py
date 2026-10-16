from fastapi import APIRouter

from app.api.routes import academy, assistant, auth, employees, notifications, requests, system

api_router = APIRouter(prefix="/api")
for r in (system, auth, employees, requests, notifications, academy, assistant):
    api_router.include_router(r.router)

from fastapi import APIRouter

from app.api.routes import academy, analytics, assistant, auth, employees, hr, hr_import, motivation, notifications, requests, system

api_router = APIRouter(prefix="/api")
for r in (system, auth, employees, requests, notifications, academy, assistant, analytics, motivation, hr_import, hr):
    api_router.include_router(r.router)

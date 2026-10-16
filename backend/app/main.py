from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.db import engine
from app.schema_sync import ensure_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models

    ensure_schema(engine, settings.reset_db_on_schema_change)
    if settings.seed_on_startup:
        from app.seed import seed

        seed()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)

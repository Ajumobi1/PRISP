import os
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.auth import router as auth_router
from app.api.tasks import router as tasks_router
from app.db import get_db_cursor


logger = logging.getLogger("prisp.backend")


def _get_allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def _get_allowed_origin_regex() -> str | None:
    configured = os.getenv("ALLOWED_ORIGIN_REGEX")
    if configured and configured.strip():
        return configured.strip()
    return None


app = FastAPI(
    title="ODCHC Backend Admin",
    description="ODCHC backend administration and API services",
    version="1.0.0",
    docs_url="/admin",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_origin_regex=_get_allowed_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def admin_redirect() -> RedirectResponse:
    return RedirectResponse(url="/admin", status_code=307)


@app.on_event("startup")
def startup_db_diagnostic() -> None:
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT current_database() AS db_name")
            row = cursor.fetchone()
        db_name = row["db_name"] if row and "db_name" in row else "unknown"
        logger.info("Startup DB check: OK (database=%s)", db_name)
    except Exception as exc:
        logger.exception("Startup DB check: FAILED (%s)", exc)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "prisp-backend"}


@app.get("/api/v1/ping")
def api_ping() -> dict[str, str]:
    return {"status": "ok", "service": "prisp-backend", "message": "pong"}


@app.get("/api/ping")
def api_ping_alias() -> dict[str, str]:
    return api_ping()


@app.get("/api/v1/runtime")
def api_runtime() -> dict[str, bool | str]:
    return {
        "status": "ok",
        "service": "prisp-backend",
        "has_DATABASE_URL": bool(os.getenv("DATABASE_URL")),
        "has_POSTGRES_URL": bool(os.getenv("POSTGRES_URL")),
        "has_POSTGRES_INTERNAL_URL": bool(os.getenv("POSTGRES_INTERNAL_URL")),
        "has_PGHOST": bool(os.getenv("PGHOST")),
        "has_POSTGRES_HOST": bool(os.getenv("POSTGRES_HOST")),
    }

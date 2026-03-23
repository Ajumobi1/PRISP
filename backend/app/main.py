import os
from datetime import datetime, timezone
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.tasks import router as tasks_router
from app.api.cof import router as cof_router
from app.api.beneficiaries import router as beneficiaries_router
from app.api.facilities import router as facilities_router
from app.db import get_db_cursor


logger = logging.getLogger("prisp.backend")
APP_STARTED_AT = datetime.now(timezone.utc).isoformat()
APP_RELEASE = os.getenv("APP_RELEASE", "local")


def _get_allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


app = FastAPI(
    title="ODCHC PRISP API",
    description="PRS Intelligence & Strategy Portal backend services",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/api/v1")
app.include_router(cof_router, prefix="/api/v1")
app.include_router(beneficiaries_router, prefix="/api/v1")
app.include_router(facilities_router, prefix="/api/v1")


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


@app.get("/api/v1/health")
def api_health_check() -> dict[str, str]:
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return {"status": "ok", "service": "prisp-backend", "database": "ok"}
    except Exception as exc:
        return {
            "status": "degraded",
            "service": "prisp-backend",
            "database": "unavailable",
            "detail": str(exc),
        }


@app.get("/api/v1/version")
def version() -> dict[str, str]:
    return {
        "service": "prisp-backend",
        "release": APP_RELEASE,
        "started_at": APP_STARTED_AT,
    }

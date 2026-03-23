from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.sqlalchemy_db import SessionLocal


router = APIRouter(prefix="/orm", tags=["ORM"])


@router.get("/health")
def orm_health() -> dict[str, str]:
    """Optional SQLAlchemy health probe (non-breaking, read-only)."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok", "orm": "sqlalchemy", "database": "ok"}
    except SQLAlchemyError as exc:
        return {
            "status": "degraded",
            "orm": "sqlalchemy",
            "database": "unavailable",
            "detail": str(exc),
        }

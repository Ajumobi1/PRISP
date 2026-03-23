from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session, sessionmaker


DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/prisp"


def _build_database_url_from_parts() -> str | None:
    host = os.getenv("PGHOST") or os.getenv("POSTGRES_HOST")
    port = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT") or "5432"
    user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER")
    password = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD")
    database = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB")

    if host and user and password and database:
        return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"

    return None


def _pick_database_url() -> str:
    raw = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_INTERNAL_URL")
        or os.getenv("POSTGRESQL_URL")
        or _build_database_url_from_parts()
        or DEFAULT_DATABASE_URL
    )

    if raw.startswith("postgresql://"):
        raw = raw.replace("postgresql://", "postgresql+psycopg://", 1)

    return raw


def _normalized_database_url() -> str:
    url_obj: URL = make_url(_pick_database_url())

    # Apply SSL mode only when explicitly provided by env to avoid breaking
    # Render internal DB URLs that may not require SSL.
    ssl_mode = os.getenv("SQLALCHEMY_SSLMODE")
    if ssl_mode:
        query = dict(url_obj.query)
        query["sslmode"] = ssl_mode
        url_obj = url_obj.set(query=query)

    return str(url_obj)


engine = create_engine(
    _normalized_database_url(),
    pool_pre_ping=True,
    pool_recycle=300,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db_session() -> Generator[Session, None, None]:
    """FastAPI dependency for optional SQLAlchemy-powered endpoints."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

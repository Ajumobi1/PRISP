import os
import time
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv


load_dotenv()


DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/prisp?connect_timeout=3"


def _running_on_render() -> bool:
    return bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID") or os.getenv("RENDER_GIT_COMMIT"))


def _build_database_url_from_parts() -> str | None:
    host = os.getenv("PGHOST") or os.getenv("POSTGRES_HOST")
    port = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT") or "5432"
    user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER")
    password = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD")
    database = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB")

    if host and user and password and database:
        return f"postgresql://{user}:{password}@{host}:{port}/{database}?connect_timeout=5"

    return None


def _pick_database_url() -> str:
    explicit_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_INTERNAL_URL")
        or os.getenv("POSTGRESQL_URL")
    )

    if explicit_url:
        if _running_on_render() and any(token in explicit_url for token in ["localhost", "127.0.0.1", "::1"]):
            raise RuntimeError(
                "Invalid DATABASE_URL on Render: localhost cannot be used. Set DATABASE_URL to your managed Postgres URL."
            )
        return explicit_url

    parts_url = _build_database_url_from_parts()
    if parts_url:
        return parts_url

    if _running_on_render():
        raise RuntimeError(
            "Database configuration missing on Render. Set DATABASE_URL (or POSTGRES_URL/POSTGRES_INTERNAL_URL)."
        )

    return DATABASE_URL


def get_database_url() -> str:
    return _pick_database_url()


def _with_param(url: str, key: str, value: str) -> str:
    parsed = urlparse(url)
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    params[key] = value
    updated_query = urlencode(params)
    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, updated_query, parsed.fragment)
    )


def _candidate_database_urls() -> list[str]:
    base_url = _pick_database_url()
    candidates = [base_url]

    parsed = urlparse(base_url)
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))

    if "connect_timeout" not in params:
        candidates.append(_with_param(base_url, "connect_timeout", "5"))

    if "sslmode" not in params:
        candidates.append(_with_param(base_url, "sslmode", "require"))

    return list(dict.fromkeys(candidates))


@contextmanager
def get_db_cursor():
    last_error: Exception | None = None
    connection = None

    for candidate_url in _candidate_database_urls():
        for attempt in range(3):
            try:
                connection = psycopg.connect(candidate_url)
                break
            except psycopg.OperationalError as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(1 + attempt)

        if connection is not None:
            break

    if connection is None:
        if last_error is not None:
            raise last_error
        raise RuntimeError("Unable to connect to database")

    try:
        with connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                yield cursor
    finally:
        connection.close()

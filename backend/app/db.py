import os
import time
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv


load_dotenv()


DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/prisp?connect_timeout=3"


def _pick_database_url() -> str:
    return (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_INTERNAL_URL")
        or os.getenv("POSTGRESQL_URL")
        or DATABASE_URL
    )


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
    last_error = None
    connection = None

    for candidate_url in _candidate_database_urls():
        for attempt in range(3):
            try:
                connection = psycopg.connect(candidate_url, row_factory=dict_row)
                break
            except psycopg.OperationalError as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(1 + attempt)

        if connection is not None:
            break

    if connection is None:
        raise last_error

    try:
        with connection:
            with connection.cursor() as cursor:
                yield cursor
    finally:
        connection.close()

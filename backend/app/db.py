import os
import time
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv


load_dotenv()


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/prisp?connect_timeout=3",
)


def _resolve_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", DATABASE_URL)
    if "onrender.com" in database_url and "sslmode=" not in database_url:
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"
    return database_url


@contextmanager
def get_db_cursor():
    last_error = None
    connection = None

    for attempt in range(3):
        try:
            connection = psycopg.connect(_resolve_database_url(), row_factory=dict_row)
            break
        except psycopg.OperationalError as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(1 + attempt)

    if connection is None:
        raise last_error

    try:
        with connection:
            with connection.cursor() as cursor:
                yield cursor
    finally:
        connection.close()

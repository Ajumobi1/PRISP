import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv


load_dotenv()


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/prisp?connect_timeout=3",
)


@contextmanager
def get_db_cursor():
    connection = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    try:
        with connection:
            with connection.cursor() as cursor:
                yield cursor
    finally:
        connection.close()

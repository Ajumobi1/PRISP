from pathlib import Path

import psycopg
from psycopg import Error

from app.db import get_database_url


DUPLICATE_SQLSTATES = {"42P07", "42710"}


def main() -> None:
    schema_path = Path(__file__).resolve().parents[2] / "database" / "schema.sql"
    schema_sql = schema_path.read_text(encoding="utf-8")
    database_url = get_database_url()

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            _run_schema(cursor, schema_sql)
        connection.commit()

def _run_schema(cursor, schema_sql: str) -> None:
    statements = [statement.strip() for statement in schema_sql.split(";") if statement.strip()]

    for statement in statements:
        try:
            cursor.execute(f"{statement};")
        except Error as exc:
            if exc.sqlstate in DUPLICATE_SQLSTATES:
                continue
            raise

if __name__ == "__main__":
    main()

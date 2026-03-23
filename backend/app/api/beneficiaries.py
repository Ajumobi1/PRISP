from typing import List

from fastapi import APIRouter, HTTPException, Query
from psycopg import OperationalError

from app.db import get_db_cursor

router = APIRouter(prefix="/beneficiaries", tags=["Beneficiaries"])


@router.get("/")
def list_beneficiaries(
    search: str = Query(""),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
):
    """List or search beneficiaries."""
    try:
        with get_db_cursor() as cursor:
            query = """
                SELECT
                    id,
                    enrollee_number,
                    full_name,
                    current_facility_id,
                    date_of_birth,
                    gender,
                    is_active
                FROM beneficiaries
                WHERE is_active = TRUE
            """
            params = []

            if search:
                query += " AND (enrollee_number ILIKE %s OR full_name ILIKE %s)"
                search_term = f"%{search}%"
                params.extend([search_term, search_term])

            query += " ORDER BY full_name LIMIT %s OFFSET %s"
            params.extend([limit, skip])

            cursor.execute(query, params)
            rows = cursor.fetchall()

            return [
                {
                    "id": str(row["id"]),
                    "enrollee_number": row["enrollee_number"],
                    "full_name": row["full_name"],
                    "current_facility_id": str(row["current_facility_id"]) if row["current_facility_id"] else None,
                    "date_of_birth": row["date_of_birth"],
                    "gender": row["gender"],
                }
                for row in rows
            ]

    except OperationalError as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to retrieve beneficiaries: {str(e)}")

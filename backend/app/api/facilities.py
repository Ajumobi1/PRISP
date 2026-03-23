from fastapi import APIRouter, HTTPException, Query
from psycopg import OperationalError

from app.db import get_db_cursor

router = APIRouter(prefix="/facilities", tags=["Facilities"])


@router.get("/")
def list_facilities(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=500),
):
    """List all active facilities."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    facility_code,
                    facility_name,
                    ownership_type,
                    lga_id,
                    is_active
                FROM facilities
                WHERE is_active = TRUE
                ORDER BY facility_name
                LIMIT %s OFFSET %s
                """,
                (limit, skip),
            )
            rows = cursor.fetchall()

            return [
                {
                    "id": str(row["id"]),
                    "facility_code": row["facility_code"],
                    "facility_name": row["facility_name"],
                    "ownership_type": row["ownership_type"],
                    "lga_id": str(row["lga_id"]) if row["lga_id"] else None,
                }
                for row in rows
            ]

    except (OperationalError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to retrieve facilities: {str(e)}")


@router.get("/{facility_id}")
def get_facility(facility_id: str):
    """Get a specific facility."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    facility_code,
                    facility_name,
                    ownership_type,
                    lga_id,
                    contact_phone,
                    is_active
                FROM facilities
                WHERE id = %s
                """,
                (facility_id,),
            )
            row = cursor.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Facility not found")

            return {
                "id": str(row["id"]),
                "facility_code": row["facility_code"],
                "facility_name": row["facility_name"],
                "ownership_type": row["ownership_type"],
                "lga_id": str(row["lga_id"]) if row["lga_id"] else None,
                "contact_phone": row["contact_phone"],
            }

    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to retrieve facility: {str(e)}")

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from psycopg import OperationalError

from app.db import get_db_cursor
from app.models.cof import CofRequest, CofRequestApproval, CofRequestCreate, CofStatus
from app.models.task import TaskPriority, TaskStatus

router = APIRouter(prefix="/cof", tags=["Change of Facility"])


def _serialize_cof(row: dict) -> CofRequest:
    """Convert database row to CofRequest model."""
    return CofRequest(
        id=str(row["id"]),
        beneficiary_id=row["beneficiary_id"],
        from_facility_id=row["from_facility_id"],
        to_facility_id=row["to_facility_id"],
        reason=row["reason"],
        request_status=CofStatus(row["request_status"]),
        requested_on=row["requested_on"],
        approved_by=row["approved_by"],
        approved_on=row["approved_on"],
        rejection_reason=row["rejection_reason"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _get_or_create_prs_head(cursor) -> str:
    """Get or create default PRS Head staff member."""
    cursor.execute(
        """
        SELECT id
        FROM staff_members
        WHERE job_title = 'Head of PRS Unit'
        LIMIT 1
        """
    )
    found = cursor.fetchone()
    if found:
        return str(found["id"])

    # Get PRS unit ID
    cursor.execute(
        """
        SELECT id
        FROM prs_units
        WHERE unit_name = 'Planning'
        LIMIT 1
        """
    )
    unit = cursor.fetchone()
    if not unit:
        raise HTTPException(status_code=500, detail="PRS Unit not found in database")

    cursor.execute(
        """
        INSERT INTO staff_members (full_name, job_title, unit_id)
        VALUES ('PRS Unit Head', 'Head of PRS Unit', %s)
        RETURNING id
        """,
        (unit["id"],),
    )
    created = cursor.fetchone()
    return str(created["id"])


def _create_task_for_cof(cursor, cof_id: str, beneficiary_id: str, from_fac: str, to_fac: str) -> None:
    """Auto-create a task for CoF review."""
    try:
        # Get or create PRS Head
        prs_head_id = _get_or_create_prs_head(cursor)

        # Get PRS Unit
        cursor.execute(
            """
            SELECT id FROM prs_units WHERE unit_name = 'Planning' LIMIT 1
            """
        )
        unit = cursor.fetchone()
        if not unit:
            return

        task_desc = f"Review Facility Change Request {cof_id[:8]} - Beneficiary {beneficiary_id}"

        cursor.execute(
            """
            INSERT INTO prs_tasks (
                unit_id,
                task_description,
                assignee_id,
                date_assigned,
                due_date,
                status,
                priority,
                created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                unit["id"],
                task_desc,
                prs_head_id,
                date.today(),
                date.today(),  # Due date same day initially
                TaskStatus.AWAITING_REVIEW.value,
                TaskPriority.HIGH.value,
                prs_head_id,
            ),
        )
    except Exception as e:
        # Log but don't fail the CoF creation
        print(f"Warning: Failed to create task for CoF {cof_id}: {e}")


@router.post("/", response_model=CofRequest, status_code=201)
def submit_cof_request(payload: CofRequestCreate):
    """Submit a new Change of Facility request."""
    try:
        with get_db_cursor() as cursor:
            # Lookup beneficiary by enrollee_number to get UUID
            cursor.execute(
                """
                SELECT id
                FROM beneficiaries
                WHERE enrollee_number = %s AND is_active = TRUE
                """,
                (payload.beneficiary_id,),
            )
            ben = cursor.fetchone()
            if not ben:
                raise HTTPException(status_code=404, detail="Beneficiary not found or inactive")
            
            beneficiary_uuid = str(ben["id"])

            # Validate facilities exist
            cursor.execute(
                """
                SELECT id
                FROM facilities
                WHERE (id = %s OR id = %s) AND is_active = TRUE
                """,
                (payload.from_facility_id, payload.to_facility_id),
            )
            if len(cursor.fetchall()) != 2:
                raise HTTPException(status_code=404, detail="One or both facilities not found or inactive")

            # Create CoF request with UUID references
            cursor.execute(
                """
                INSERT INTO cof_requests (beneficiary_id, from_facility_id, to_facility_id, reason)
                VALUES (%s, %s, %s, %s)
                RETURNING *
                """,
                (
                    beneficiary_uuid,
                    payload.from_facility_id,
                    payload.to_facility_id,
                    payload.reason,
                ),
            )
            new_cof = cursor.fetchone()
            cof_id = str(new_cof["id"])

            # Auto-create task for PRS Head to review
            _create_task_for_cof(
                cursor,
                cof_id,
                payload.beneficiary_id,
                payload.from_facility_id,
                payload.to_facility_id,
            )

            return _serialize_cof(new_cof)

    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create CoF request: {str(e)}")


@router.get("/", response_model=List[CofRequest])
def list_cof_requests(
    status: Optional[str] = Query(None),
    beneficiary_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
):
    """List all Change of Facility requests with optional filters."""
    try:
        with get_db_cursor() as cursor:
            base_query = """
                SELECT *
                FROM cof_requests
                WHERE 1=1
            """
            params = []

            if status:
                base_query += " AND request_status = %s"
                params.append(status)

            if beneficiary_id:
                base_query += " AND beneficiary_id = %s"
                params.append(beneficiary_id)

            base_query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, skip])

            cursor.execute(base_query, params)
            rows = cursor.fetchall()

            return [_serialize_cof(row) for row in rows]

    except (OperationalError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to retrieve CoF requests: {str(e)}")


@router.get("/{cof_id}", response_model=CofRequest)
def get_cof_request(cof_id: str):
    """Get a specific Change of Facility request."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT *
                FROM cof_requests
                WHERE id = %s
                """,
                (cof_id,),
            )
            row = cursor.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="CoF request not found")

            return _serialize_cof(row)

    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to retrieve CoF request: {str(e)}")


@router.post("/{cof_id}/approve", response_model=CofRequest)
def approve_cof_request(cof_id: str, payload: CofRequestApproval):
    """Approve a Change of Facility request and update beneficiary's facility."""
    try:
        with get_db_cursor() as cursor:
            # Get CoF request
            cursor.execute(
                """
                SELECT *
                FROM cof_requests
                WHERE id = %s
                """,
                (cof_id,),
            )
            cof = cursor.fetchone()

            if not cof:
                raise HTTPException(status_code=404, detail="CoF request not found")

            if cof["request_status"] != CofStatus.SUBMITTED.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot approve CoF in {cof['request_status']} status",
                )

            # Update CoF request status
            cursor.execute(
                """
                UPDATE cof_requests
                SET request_status = %s, approved_by = %s, approved_on = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING *
                """,
                (CofStatus.APPROVED.value, payload.approved_by, date.today(), cof_id),
            )
            updated_cof = cursor.fetchone()

            # Update beneficiary's facility using the UUID from the CoF record
            cursor.execute(
                """
                UPDATE beneficiaries
                SET current_facility_id = %s
                WHERE id = %s
                """,
                (cof["to_facility_id"], cof["beneficiary_id"]),
            )

            # Update related task status to Completed
            cursor.execute(
                """
                UPDATE prs_tasks
                SET status = %s, completed_at = NOW(), updated_at = NOW()
                WHERE task_description LIKE %s AND status != %s
                """,
                (
                    TaskStatus.COMPLETED.value,
                    f"%{cof_id[:8]}%",
                    TaskStatus.COMPLETED.value,
                ),
            )

            return _serialize_cof(updated_cof)

    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to approve CoF request: {str(e)}")


@router.post("/{cof_id}/reject", response_model=CofRequest)
def reject_cof_request(cof_id: str, payload: CofRequestApproval):
    """Reject a Change of Facility request."""
    try:
        with get_db_cursor() as cursor:
            # Get CoF request
            cursor.execute(
                """
                SELECT *
                FROM cof_requests
                WHERE id = %s
                """,
                (cof_id,),
            )
            cof = cursor.fetchone()

            if not cof:
                raise HTTPException(status_code=404, detail="CoF request not found")

            if cof["request_status"] != CofStatus.SUBMITTED.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot reject CoF in {cof['request_status']} status",
                )

            # Update CoF request status
            cursor.execute(
                """
                UPDATE cof_requests
                SET request_status = %s, rejection_reason = %s, approved_by = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING *
                """,
                (CofStatus.REJECTED.value, payload.rejection_reason, payload.approved_by, cof_id),
            )
            updated_cof = cursor.fetchone()

            # Update related task status to Delayed with remarks
            cursor.execute(
                """
                UPDATE prs_tasks
                SET status = %s, remarks = %s, updated_at = NOW()
                WHERE task_description LIKE %s AND status != %s
                """,
                (
                    TaskStatus.DELAYED.value,
                    f"CoF rejected: {payload.rejection_reason}",
                    f"%{cof_id[:8]}%",
                    TaskStatus.COMPLETED.value,
                ),
            )

            return _serialize_cof(updated_cof)

    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail="Database connection failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to reject CoF request: {str(e)}")

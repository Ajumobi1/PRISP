import csv
import io
import re
from datetime import date, datetime
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from openpyxl import Workbook
from psycopg import OperationalError
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.db import get_db_cursor
from app.models.task import PRSTask, PRSTaskCreate, TaskAttachment, TaskPriority, TaskStatus


router = APIRouter(prefix="/tasks", tags=["PRS Task Tracker"])

DEFAULT_UNITS = ["Planning", "Research", "Statistics", "M&E"]
FALLBACK_CREATED_TASKS: list[PRSTask] = []
TASK_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "tasks"


def _fallback_tasks(status: TaskStatus | None = None) -> list[PRSTask]:
    tasks = FALLBACK_CREATED_TASKS
    if status is None:
        return tasks
    return [task for task in tasks if task.status == status]


def _ensure_seed_units() -> None:
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO prs_units (unit_code, unit_name)
            VALUES
              ('PLN', 'Planning'),
              ('RSH', 'Research'),
              ('STA', 'Statistics'),
              ('MNE', 'M&E')
            ON CONFLICT (unit_name) DO NOTHING
            """
        )


def _ensure_task_attachments_table() -> None:
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS task_attachments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES prs_tasks(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                storage_name VARCHAR(255) NOT NULL,
                content_type VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
                file_size BIGINT NOT NULL,
                uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )


def _ensure_task_columns() -> None:
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE prs_tasks
            ADD COLUMN IF NOT EXISTS task_title VARCHAR(255) NOT NULL DEFAULT 'Task',
            ADD COLUMN IF NOT EXISTS deliverable TEXT,
            ADD COLUMN IF NOT EXISTS checklist TEXT
            """
        )


def _safe_file_name(raw_name: str) -> str:
    base_name = Path(raw_name).name
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", base_name).strip("._")
    return safe_name or f"attachment_{uuid4().hex}"


def _task_upload_dir(task_id: str) -> Path:
    return TASK_UPLOADS_DIR / task_id


def _serialize_attachment(row: dict) -> TaskAttachment:
    return TaskAttachment(
        id=str(row["id"]),
        task_id=str(row["task_id"]),
        file_name=row["file_name"],
        content_type=row["content_type"],
        file_size=int(row["file_size"]),
        uploaded_at=row["uploaded_at"],
    )


def _get_or_create_assignee(cursor, assignee_name: str, unit_id: str) -> str:
    cursor.execute(
        """
        SELECT id
        FROM staff_members
        WHERE full_name = %s
        LIMIT 1
        """,
        (assignee_name,),
    )
    found = cursor.fetchone()
    if found:
        return str(found["id"])

    cursor.execute(
        """
        INSERT INTO staff_members (full_name, unit_id)
        VALUES (%s, %s)
        RETURNING id
        """,
        (assignee_name, unit_id),
    )
    created = cursor.fetchone()
    return str(created["id"])


def _serialize_task(row: dict) -> PRSTask:
    return PRSTask(
        id=str(row["id"]),
        serial_number=row["serial_number"],
        unit=row["unit_name"],
        task_title=row.get("task_title") or "Task",
        task_description=row["task_description"],
        assignee=row["assignee_name"],
        date_assigned=row["date_assigned"],
        due_date=row["due_date"],
        status=TaskStatus(row["status"]),
        priority=TaskPriority(row["priority"]),
        deliverable=row.get("deliverable"),
        checklist=row.get("checklist"),
        remarks=row["remarks"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _list_task_rows(status: TaskStatus | None = None) -> list[dict]:
    base_query = """
        SELECT
            t.id,
            t.serial_number,
            u.unit_name,
            t.task_title,
            t.task_description,
            s.full_name AS assignee_name,
            t.date_assigned,
            t.due_date,
            t.status,
            t.priority,
            t.deliverable,
            t.checklist,
            t.remarks,
            t.created_at,
            t.updated_at
        FROM prs_tasks t
        JOIN prs_units u ON u.id = t.unit_id
        JOIN staff_members s ON s.id = t.assignee_id
    """

    with get_db_cursor() as cursor:
        if status is None:
            cursor.execute(f"{base_query} ORDER BY t.serial_number ASC")
        else:
            cursor.execute(
                f"{base_query} WHERE t.status = %s ORDER BY t.serial_number ASC",
                (status.value,),
            )
        return list(cursor.fetchall())


def _export_csv(rows: list[PRSTask]) -> bytes:
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(
        [
            "S/N",
            "Task",
            "Unit",
            "Task Description",
            "Responsible Person(s)",
            "Date Assigned",
            "Due Date",
            "Status",
            "Priority",
            "Deliverable",
            "Checklist",
            "Remarks/Comments",
        ]
    )
    for task in rows:
        writer.writerow(
            [
                task.serial_number,
                task.task_title,
                task.unit,
                task.task_description,
                task.assignee,
                task.date_assigned.isoformat(),
                task.due_date.isoformat(),
                task.status.value,
                task.priority.value,
                task.deliverable or "",
                task.checklist or "",
                task.remarks or "",
            ]
        )
    return stream.getvalue().encode("utf-8")


def _export_xlsx(rows: list[PRSTask]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "PRS Tasks"
    headers = [
        "S/N",
        "Task",
        "Unit",
        "Task Description",
        "Responsible Person(s)",
        "Date Assigned",
        "Due Date",
        "Status",
        "Priority",
        "Deliverable",
        "Checklist",
        "Remarks/Comments",
    ]
    sheet.append(headers)

    for task in rows:
        sheet.append(
            [
                task.serial_number,
                task.task_title,
                task.unit,
                task.task_description,
                task.assignee,
                task.date_assigned.isoformat(),
                task.due_date.isoformat(),
                task.status.value,
                task.priority.value,
                task.deliverable or "",
                task.checklist or "",
                task.remarks or "",
            ]
        )

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def _export_pdf(rows: list[PRSTask]) -> bytes:
    output = io.BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    title = Paragraph("ODCHC PRISP - PRS Unit Task Tracker", styles["Heading2"])
    subtitle = Paragraph(f"Generated: {datetime.utcnow().isoformat()} UTC", styles["Normal"])

    table_data = [
        [
            "S/N",
            "Task",
            "Unit",
            "Task Description",
            "Assignee",
            "Date Assigned",
            "Due Date",
            "Status",
            "Priority",
            "Deliverable",
            "Checklist",
            "Remarks/Comments",
        ]
    ]
    for task in rows:
        table_data.append(
            [
                str(task.serial_number),
                task.task_title,
                task.unit,
                task.task_description,
                task.assignee,
                task.date_assigned.isoformat(),
                task.due_date.isoformat(),
                task.status.value,
                task.priority.value,
                (task.deliverable or "")[:80],
                (task.checklist or "")[:80],
                (task.remarks or "")[:80],
            ]
        )

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )

    document.build([title, Spacer(1, 8), subtitle, Spacer(1, 12), table])
    return output.getvalue()


@router.get("", response_model=List[PRSTask])
def list_tasks(status: TaskStatus | None = Query(default=None)) -> list[PRSTask]:
    try:
        _ensure_seed_units()
        _ensure_task_columns()
        rows = _list_task_rows(status=status)
        return [_serialize_task(row) for row in rows]
    except (OperationalError, RuntimeError):
        return _fallback_tasks(status)


@router.post("", response_model=PRSTask, status_code=201)
def create_task(payload: PRSTaskCreate) -> PRSTask:
    try:
        _ensure_seed_units()
        _ensure_task_columns()

        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT id, unit_name FROM prs_units WHERE unit_name = %s LIMIT 1",
                (payload.unit,),
            )
            unit_record = cursor.fetchone()
            if not unit_record:
                raise HTTPException(status_code=400, detail="Invalid unit")

            unit_id = str(unit_record["id"])
            assignee_id = _get_or_create_assignee(cursor, payload.assignee, unit_id)

            cursor.execute(
                """
                INSERT INTO prs_tasks (
                    unit_id,
                    task_title,
                    task_description,
                    assignee_id,
                    date_assigned,
                    due_date,
                    status,
                    priority,
                    deliverable,
                    checklist,
                    remarks
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    unit_id,
                    payload.task_title,
                    payload.task_description,
                    assignee_id,
                    payload.date_assigned,
                    payload.due_date,
                    payload.status.value,
                    payload.priority.value,
                    payload.deliverable,
                    payload.checklist,
                    payload.remarks,
                ),
            )
            inserted = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    t.id,
                    t.serial_number,
                    u.unit_name,
                    t.task_title,
                    t.task_description,
                    s.full_name AS assignee_name,
                    t.date_assigned,
                    t.due_date,
                    t.status,
                    t.priority,
                    t.deliverable,
                    t.checklist,
                    t.remarks,
                    t.created_at,
                    t.updated_at
                FROM prs_tasks t
                JOIN prs_units u ON u.id = t.unit_id
                JOIN staff_members s ON s.id = t.assignee_id
                WHERE t.id = %s
                """,
                (inserted["id"],),
            )
            row = cursor.fetchone()
            return _serialize_task(row)
    except (OperationalError, RuntimeError) as exc:
        now = datetime.utcnow()
        fallback_task = PRSTask(
            id=f"offline-{uuid4()}",
            serial_number=len(_fallback_tasks()) + 1,
            unit=payload.unit,
            task_title=payload.task_title,
            task_description=payload.task_description,
            assignee=payload.assignee,
            date_assigned=payload.date_assigned,
            due_date=payload.due_date,
            status=payload.status,
            priority=payload.priority,
            deliverable=payload.deliverable,
            checklist=payload.checklist,
            remarks=(payload.remarks or "") + " [offline mode: DB unavailable]",
            created_at=now,
            updated_at=now,
        )
        FALLBACK_CREATED_TASKS.append(fallback_task)
        return fallback_task


@router.post("/{task_id}/attachments", response_model=List[TaskAttachment], status_code=201)
async def upload_task_attachments(task_id: str, files: list[UploadFile] = File(...)) -> list[TaskAttachment]:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    try:
        _ensure_task_attachments_table()

        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM prs_tasks WHERE id = %s", (task_id,))
            task = cursor.fetchone()
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")

            upload_dir = _task_upload_dir(task_id)
            upload_dir.mkdir(parents=True, exist_ok=True)

            created_rows: list[dict] = []
            for incoming_file in files:
                original_name = _safe_file_name(incoming_file.filename or "uploaded_file")
                storage_name = f"{uuid4().hex}_{original_name}"
                destination = upload_dir / storage_name

                file_bytes = await incoming_file.read()
                destination.write_bytes(file_bytes)

                cursor.execute(
                    """
                    INSERT INTO task_attachments (task_id, file_name, storage_name, content_type, file_size)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, task_id, file_name, content_type, file_size, uploaded_at
                    """,
                    (
                        task_id,
                        original_name,
                        storage_name,
                        incoming_file.content_type or "application/octet-stream",
                        len(file_bytes),
                    ),
                )
                inserted = cursor.fetchone()
                if inserted:
                    created_rows.append(inserted)

        return [_serialize_attachment(row) for row in created_rows]
    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/{task_id}/attachments", response_model=List[TaskAttachment])
def list_task_attachments(task_id: str) -> list[TaskAttachment]:
    try:
        _ensure_task_attachments_table()

        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM prs_tasks WHERE id = %s", (task_id,))
            task = cursor.fetchone()
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")

            cursor.execute(
                """
                SELECT id, task_id, file_name, content_type, file_size, uploaded_at
                FROM task_attachments
                WHERE task_id = %s
                ORDER BY uploaded_at DESC
                """,
                (task_id,),
            )
            rows = cursor.fetchall()
            return [_serialize_attachment(row) for row in rows]
    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/{task_id}/attachments/{attachment_id}")
def download_task_attachment(task_id: str, attachment_id: str):
    try:
        _ensure_task_attachments_table()

        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT id, task_id, file_name, storage_name, content_type
                FROM task_attachments
                WHERE id = %s AND task_id = %s
                """,
                (attachment_id, task_id),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Attachment not found")

        file_path = _task_upload_dir(task_id) / row["storage_name"]
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="Attachment file missing")

        return FileResponse(
            path=str(file_path),
            media_type=row["content_type"] or "application/octet-stream",
            filename=row["file_name"],
        )
    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.delete("/{task_id}/attachments/{attachment_id}", status_code=204)
def delete_task_attachment(task_id: str, attachment_id: str) -> None:
    try:
        _ensure_task_attachments_table()

        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT storage_name
                FROM task_attachments
                WHERE id = %s AND task_id = %s
                """,
                (attachment_id, task_id),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Attachment not found")

            storage_name = row["storage_name"]

            cursor.execute(
                """
                DELETE FROM task_attachments
                WHERE id = %s AND task_id = %s
                """,
                (attachment_id, task_id),
            )

        file_path = _task_upload_dir(task_id) / storage_name
        if file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)

        upload_dir = _task_upload_dir(task_id)
        if upload_dir.exists() and upload_dir.is_dir() and not any(upload_dir.iterdir()):
            upload_dir.rmdir()
    except HTTPException:
        raise
    except (OperationalError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/{task_id}", response_model=PRSTask)
def get_task(task_id: str) -> PRSTask:
    try:
        _ensure_task_columns()
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    t.id,
                    t.serial_number,
                    u.unit_name,
                    t.task_title,
                    t.task_description,
                    s.full_name AS assignee_name,
                    t.date_assigned,
                    t.due_date,
                    t.status,
                    t.priority,
                    t.deliverable,
                    t.checklist,
                    t.remarks,
                    t.created_at,
                    t.updated_at
                FROM prs_tasks t
                JOIN prs_units u ON u.id = t.unit_id
                JOIN staff_members s ON s.id = t.assignee_id
                WHERE t.id = %s
                """,
                (task_id,),
            )
            row = cursor.fetchone()
            if row:
                return _serialize_task(row)
    except (OperationalError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    raise HTTPException(status_code=404, detail="Task not found")


@router.put("/{task_id}", response_model=PRSTask)
def update_task(task_id: str, payload: PRSTaskCreate) -> PRSTask:
    try:
        _ensure_seed_units()
        _ensure_task_columns()

        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM prs_units WHERE unit_name = %s LIMIT 1", (payload.unit,))
            unit_record = cursor.fetchone()
            if not unit_record:
                raise HTTPException(status_code=400, detail="Invalid unit")

            unit_id = str(unit_record["id"])
            assignee_id = _get_or_create_assignee(cursor, payload.assignee, unit_id)

            cursor.execute(
                """
                UPDATE prs_tasks
                SET unit_id = %s,
                    task_title = %s,
                    task_description = %s,
                    assignee_id = %s,
                    date_assigned = %s,
                    due_date = %s,
                    status = %s,
                    priority = %s,
                    deliverable = %s,
                    checklist = %s,
                    remarks = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id
                """,
                (
                    unit_id,
                    payload.task_title,
                    payload.task_description,
                    assignee_id,
                    payload.date_assigned,
                    payload.due_date,
                    payload.status.value,
                    payload.priority.value,
                    payload.deliverable,
                    payload.checklist,
                    payload.remarks,
                    task_id,
                ),
            )
            updated = cursor.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Task not found")

            cursor.execute(
                """
                SELECT
                    t.id,
                    t.serial_number,
                    u.unit_name,
                    t.task_title,
                    t.task_description,
                    s.full_name AS assignee_name,
                    t.date_assigned,
                    t.due_date,
                    t.status,
                    t.priority,
                    t.deliverable,
                    t.checklist,
                    t.remarks,
                    t.created_at,
                    t.updated_at
                FROM prs_tasks t
                JOIN prs_units u ON u.id = t.unit_id
                JOIN staff_members s ON s.id = t.assignee_id
                WHERE t.id = %s
                """,
                (task_id,),
            )
            row = cursor.fetchone()
            return _serialize_task(row)
    except (OperationalError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str) -> None:
    try:
        _ensure_task_attachments_table()

        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM prs_tasks WHERE id = %s RETURNING id", (task_id,))
            deleted = cursor.fetchone()
            if not deleted:
                raise HTTPException(status_code=404, detail="Task not found")

        upload_dir = _task_upload_dir(task_id)
        if upload_dir.exists() and upload_dir.is_dir():
            for child in upload_dir.iterdir():
                if child.is_file():
                    child.unlink(missing_ok=True)
            upload_dir.rmdir()
    except (OperationalError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


@router.get("/export/{export_format}")
def export_tasks(export_format: str, status: TaskStatus | None = Query(default=None)) -> StreamingResponse:
    try:
        _ensure_seed_units()
        _ensure_task_columns()
        rows = [_serialize_task(row) for row in _list_task_rows(status=status)]
    except (OperationalError, RuntimeError):
        rows = _fallback_tasks(status)
    timestamp = date.today().isoformat()

    if export_format == "csv":
        data = _export_csv(rows)
        filename = f"prisp-prs-task-tracker-{timestamp}.csv"
        media_type = "text/csv"
    elif export_format == "xlsx":
        data = _export_xlsx(rows)
        filename = f"prisp-prs-task-tracker-{timestamp}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif export_format == "pdf":
        data = _export_pdf(rows)
        filename = f"prisp-prs-task-tracker-{timestamp}.pdf"
        media_type = "application/pdf"
    else:
        raise HTTPException(status_code=400, detail="export_format must be csv, xlsx, or pdf")

    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

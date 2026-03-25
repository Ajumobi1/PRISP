import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException

from app.db import get_db_cursor
from app.models.auth import (
    AuthTokenResponse,
    LoginPayload,
    RegisterPayload,
    UserAccountSummary,
    UserStatusUpdatePayload,
)
from app.security import generate_session_token, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["Authentication"])
ADMIN_PREFIX = "admin"
SESSION_HOURS = 12

DEFAULT_ADMIN_FULL_NAME = os.getenv("DEFAULT_ADMIN_FULL_NAME", "System Administrator").strip() or "System Administrator"
DEFAULT_ADMIN_USERNAME_RAW = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_EMAIL_RAW = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@prisp.local")
DEFAULT_ADMIN_DEPARTMENT = os.getenv("DEFAULT_ADMIN_DEPARTMENT", "Administration").strip() or "Administration"
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin")
DEFAULT_ADMIN_FORCE_RESET = os.getenv("DEFAULT_ADMIN_FORCE_RESET", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _ensure_auth_tables() -> None:
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS app_users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                full_name VARCHAR(180) NOT NULL,
                username VARCHAR(60) UNIQUE NOT NULL,
                email VARCHAR(180) UNIQUE NOT NULL,
                department VARCHAR(120) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS app_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )


def _normalize_username(username: str) -> str:
    return username.strip().lower()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _serialize_user(row: dict) -> UserAccountSummary:
    return UserAccountSummary(
        id=str(row["id"]),
        full_name=row["full_name"],
        username=row["username"],
        email=row["email"],
        department=row["department"],
        role=row["role"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    return parts[1].strip()


def _get_session_user(authorization: str | None) -> dict:
    token = _extract_bearer_token(authorization)
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT u.*, s.expires_at
            FROM app_sessions s
            JOIN app_users u ON u.id = s.user_id
            WHERE s.token = %s
            LIMIT 1
            """,
            (token,),
        )
        row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    return row


def _require_admin(authorization: str | None) -> dict:
    user = _get_session_user(authorization)
    if user["role"] != ADMIN_PREFIX:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _seed_default_admin_if_missing() -> None:
    default_username = _normalize_username(DEFAULT_ADMIN_USERNAME_RAW)
    default_email = _normalize_email(DEFAULT_ADMIN_EMAIL_RAW)

    with get_db_cursor() as cursor:
        cursor.execute("SELECT COUNT(1) AS total FROM app_users WHERE role = 'admin'")
        row = cursor.fetchone()
        total_admins = row["total"] if row else 0

        if total_admins and not DEFAULT_ADMIN_FORCE_RESET:
            return

        if total_admins and DEFAULT_ADMIN_FORCE_RESET:
            cursor.execute(
                """
                SELECT id
                FROM app_users
                WHERE role = 'admin'
                ORDER BY created_at ASC
                LIMIT 1
                """
            )
            existing_admin = cursor.fetchone()
            if not existing_admin:
                return

            cursor.execute(
                """
                UPDATE app_users
                SET full_name = %s,
                    username = %s,
                    email = %s,
                    department = %s,
                    status = 'approved',
                    password_hash = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (
                    DEFAULT_ADMIN_FULL_NAME,
                    default_username,
                    default_email,
                    DEFAULT_ADMIN_DEPARTMENT,
                    hash_password(DEFAULT_ADMIN_PASSWORD),
                    existing_admin["id"],
                ),
            )
            cursor.execute("DELETE FROM app_sessions WHERE user_id = %s", (existing_admin["id"],))
            return

        cursor.execute(
            """
            INSERT INTO app_users (full_name, username, email, department, role, status, password_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                DEFAULT_ADMIN_FULL_NAME,
                default_username,
                default_email,
                DEFAULT_ADMIN_DEPARTMENT,
                "admin",
                "approved",
                hash_password(DEFAULT_ADMIN_PASSWORD),
            ),
        )


@router.post("/register", status_code=201)
def register(payload: RegisterPayload) -> dict[str, str]:
    _ensure_auth_tables()
    _seed_default_admin_if_missing()

    username = _normalize_username(payload.username)
    email = _normalize_email(payload.email)

    with get_db_cursor() as cursor:
        cursor.execute(
            "SELECT id FROM app_users WHERE username = %s OR email = %s LIMIT 1",
            (username, email),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username or email already exists")

        cursor.execute(
            """
            INSERT INTO app_users (full_name, username, email, department, role, status, password_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                payload.full_name.strip(),
                username,
                email,
                payload.department.strip(),
                "user",
                "pending",
                hash_password(payload.password),
            ),
        )

    return {"detail": "Account submitted. Await admin approval."}


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: LoginPayload) -> AuthTokenResponse:
    _ensure_auth_tables()
    _seed_default_admin_if_missing()

    username = _normalize_username(payload.username)
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, full_name, username, role, status, password_hash
            FROM app_users
            WHERE username = %s
            LIMIT 1
            """,
            (username,),
        )
        row = cursor.fetchone()

        if not row or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if row["status"] == "pending":
            raise HTTPException(status_code=403, detail="Account pending admin approval")
        if row["status"] == "declined":
            raise HTTPException(status_code=403, detail="Account request declined")
        if row["status"] == "locked":
            raise HTTPException(status_code=403, detail="Account locked by admin")

        token = generate_session_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)
        cursor.execute(
            """
            INSERT INTO app_sessions (user_id, token, expires_at)
            VALUES (%s, %s, %s)
            """,
            (row["id"], token, expires_at),
        )

    return AuthTokenResponse(
        access_token=token,
        role=row["role"],
        username=row["username"],
        full_name=row["full_name"],
    )


@router.get("/me", response_model=UserAccountSummary)
def me(authorization: str | None = Header(default=None)) -> UserAccountSummary:
    _ensure_auth_tables()
    user = _get_session_user(authorization)
    return _serialize_user(user)


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)) -> dict[str, str]:
    _ensure_auth_tables()
    token = _extract_bearer_token(authorization)

    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM app_sessions WHERE token = %s", (token,))

    return {"detail": "Logged out"}


@router.get("/admin/users", response_model=list[UserAccountSummary])
def list_users_for_admin(authorization: str | None = Header(default=None)) -> list[UserAccountSummary]:
    _ensure_auth_tables()
    _require_admin(authorization)

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, full_name, username, email, department, role, status, created_at, updated_at
            FROM app_users
            ORDER BY created_at DESC
            """
        )
        rows = cursor.fetchall()

    return [_serialize_user(row) for row in rows]


@router.patch("/admin/users/{user_id}/status", response_model=UserAccountSummary)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdatePayload,
    authorization: str | None = Header(default=None),
) -> UserAccountSummary:
    _ensure_auth_tables()
    admin_user = _require_admin(authorization)

    with get_db_cursor() as cursor:
        cursor.execute(
            "SELECT id, role FROM app_users WHERE id = %s LIMIT 1",
            (user_id,),
        )
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        if str(target["id"]) == str(admin_user["id"]):
            raise HTTPException(status_code=400, detail="Admin cannot change own account status")

        cursor.execute(
            """
            UPDATE app_users
            SET status = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, full_name, username, email, department, role, status, created_at, updated_at
            """,
            (payload.status, user_id),
        )
        updated = cursor.fetchone()

        if payload.status in {"declined", "locked"}:
            cursor.execute("DELETE FROM app_sessions WHERE user_id = %s", (user_id,))

    return _serialize_user(updated)

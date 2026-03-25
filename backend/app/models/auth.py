from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AccountStatus = Literal["pending", "approved", "declined", "locked"]
AccountRole = Literal["user", "admin"]


class RegisterPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=180)
    username: str = Field(min_length=3, max_length=60)
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=8, max_length=128)
    department: str = Field(min_length=2, max_length=120)


class LoginPayload(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=8, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: AccountRole
    username: str
    full_name: str


class UserAccountSummary(BaseModel):
    id: str
    full_name: str
    username: str
    email: str
    department: str
    role: AccountRole
    status: AccountStatus
    created_at: datetime
    updated_at: datetime


class UserStatusUpdatePayload(BaseModel):
    status: AccountStatus

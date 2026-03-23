from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class CofStatus(str, Enum):
    SUBMITTED = "Submitted"
    UNDER_REVIEW = "Under Review"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class CofRequestBase(BaseModel):
    beneficiary_id: str = Field(min_length=1)
    from_facility_id: str = Field(min_length=1)
    to_facility_id: str = Field(min_length=1)
    reason: str = Field(min_length=5)


class CofRequestCreate(CofRequestBase):
    pass


class CofRequestApproval(BaseModel):
    approved_by: str = Field(min_length=1)
    rejection_reason: Optional[str] = None


class CofRequest(CofRequestBase):
    id: str
    request_status: CofStatus
    requested_on: date
    approved_by: Optional[str] = None
    approved_on: Optional[date] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

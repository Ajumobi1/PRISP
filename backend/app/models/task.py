from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    NOT_STARTED = "Not Started"
    IN_PROGRESS = "In Progress"
    AWAITING_REVIEW = "Awaiting Review"
    COMPLETED = "Completed"
    DELAYED = "Delayed"


class TaskPriority(str, Enum):
    HIGH = "Urgent/High"
    MEDIUM = "Medium"
    LOW = "Low"


class PRSTaskBase(BaseModel):
    unit: str = Field(min_length=2)
    task_description: str = Field(min_length=5)
    assignee: str = Field(min_length=2)
    date_assigned: date
    due_date: date
    status: TaskStatus
    priority: TaskPriority
    remarks: Optional[str] = None


class PRSTaskCreate(PRSTaskBase):
    pass


class PRSTask(PRSTaskBase):
    id: str
    serial_number: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskAttachment(BaseModel):
    id: str
    task_id: str
    file_name: str
    content_type: str
    file_size: int
    uploaded_at: datetime

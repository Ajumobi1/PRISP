from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


task_status_enum = Enum(
    "Not Started",
    "In Progress",
    "Awaiting Review",
    "Completed",
    "Delayed",
    name="task_status",
    create_type=False,
)

task_priority_enum = Enum(
    "Urgent/High",
    "Medium",
    "Low",
    name="task_priority",
    create_type=False,
)

cof_status_enum = Enum(
    "Submitted",
    "Under Review",
    "Approved",
    "Rejected",
    name="cof_status",
    create_type=False,
)


class LGA(Base):
    __tablename__ = "lgas"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    lga_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    lga_name: Mapped[str] = mapped_column(String(120), nullable=False)
    state_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Ondo")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class PRSUnit(Base):
    __tablename__ = "prs_units"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    unit_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    unit_name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    staff_members: Mapped[list[StaffMember]] = relationship(back_populates="unit")
    tasks: Mapped[list[PRSTaskModel]] = relationship(back_populates="unit")


class StaffMember(Base):
    __tablename__ = "staff_members"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    staff_code: Mapped[Optional[str]] = mapped_column(String(40), unique=True)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(180), unique=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(120))
    unit_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("prs_units.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    unit: Mapped[Optional[PRSUnit]] = relationship(back_populates="staff_members")
    assigned_tasks: Mapped[list[PRSTaskModel]] = relationship(
        back_populates="assignee",
        foreign_keys="PRSTaskModel.assignee_id",
    )


class PRSTaskModel(Base):
    __tablename__ = "prs_tasks"

    __table_args__ = (
        CheckConstraint("due_date >= date_assigned", name="chk_due_after_assigned"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    serial_number: Mapped[int] = mapped_column(nullable=False, unique=True)
    unit_id: Mapped[UUID] = mapped_column(ForeignKey("prs_units.id"), nullable=False)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    assignee_id: Mapped[UUID] = mapped_column(ForeignKey("staff_members.id"), nullable=False)
    date_assigned: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(task_status_enum, nullable=False, default="Not Started")
    priority: Mapped[str] = mapped_column(task_priority_enum, nullable=False, default="Medium")
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("staff_members.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    unit: Mapped[PRSUnit] = relationship(back_populates="tasks")
    assignee: Mapped[StaffMember] = relationship(foreign_keys=[assignee_id], back_populates="assigned_tasks")


class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    task_id: Mapped[UUID] = mapped_column(ForeignKey("prs_tasks.id", ondelete="CASCADE"), nullable=False)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    commented_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("staff_members.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class TaskStatusHistory(Base):
    __tablename__ = "task_status_history"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    task_id: Mapped[UUID] = mapped_column(ForeignKey("prs_tasks.id", ondelete="CASCADE"), nullable=False)
    old_status: Mapped[Optional[str]] = mapped_column(task_status_enum)
    new_status: Mapped[str] = mapped_column(task_status_enum, nullable=False)
    changed_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("staff_members.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    note: Mapped[Optional[str]] = mapped_column(Text)


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    facility_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    facility_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ownership_type: Mapped[Optional[str]] = mapped_column(String(50))
    lga_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("lgas.id"))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    enrollee_number: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    lga_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("lgas.id"))
    current_facility_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("facilities.id"))
    enrollment_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class FacilityMonthlyReport(Base):
    __tablename__ = "facility_monthly_reports"
    __table_args__ = (
        UniqueConstraint("facility_id", "report_month", name="facility_monthly_reports_facility_month_key"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    facility_id: Mapped[UUID] = mapped_column(ForeignKey("facilities.id"), nullable=False)
    report_month: Mapped[date] = mapped_column(Date, nullable=False)
    service_utilization: Mapped[dict] = mapped_column(JSONB, nullable=False)
    encounters_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    disease_surveillance: Mapped[dict] = mapped_column(JSONB, nullable=False)
    submitted_by: Mapped[Optional[str]] = mapped_column(String(180))
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    approval_status: Mapped[str] = mapped_column(String(40), nullable=False, default="Submitted")


class CapitationCycle(Base):
    __tablename__ = "capitation_cycles"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    cycle_month: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    total_beneficiaries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    amount_per_beneficiary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    total_disbursed: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False, default=0)
    payment_status: Mapped[str] = mapped_column(String(40), nullable=False, default="Draft")
    generated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class CapitationPayment(Base):
    __tablename__ = "capitation_payments"
    __table_args__ = (
        UniqueConstraint("capitation_cycle_id", "facility_id", name="capitation_payments_cycle_facility_key"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    capitation_cycle_id: Mapped[UUID] = mapped_column(
        ForeignKey("capitation_cycles.id", ondelete="CASCADE"), nullable=False
    )
    facility_id: Mapped[UUID] = mapped_column(ForeignKey("facilities.id"), nullable=False)
    enrolled_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    deduction_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(80))
    payment_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class CofRequest(Base):
    __tablename__ = "cof_requests"
    __table_args__ = (
        CheckConstraint("from_facility_id <> to_facility_id", name="chk_facility_transfer_unique"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    beneficiary_id: Mapped[UUID] = mapped_column(ForeignKey("beneficiaries.id"), nullable=False)
    from_facility_id: Mapped[UUID] = mapped_column(ForeignKey("facilities.id"), nullable=False)
    to_facility_id: Mapped[UUID] = mapped_column(ForeignKey("facilities.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    request_status: Mapped[str] = mapped_column(cof_status_enum, nullable=False, default="Submitted")
    requested_on: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    approved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("staff_members.id"))
    approved_on: Mapped[Optional[date]] = mapped_column(Date)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class UHCTarget(Base):
    __tablename__ = "uhc_targets"
    __table_args__ = (
        UniqueConstraint("target_year", "lga_id", name="uhc_targets_year_lga_key"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    target_year: Mapped[int] = mapped_column(Integer, nullable=False)
    lga_id: Mapped[UUID] = mapped_column(ForeignKey("lgas.id"), nullable=False)
    target_enrollees: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_enrollees: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class ModuleExport(Base):
    __tablename__ = "module_exports"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True)
    module_name: Mapped[str] = mapped_column(String(80), nullable=False)
    export_format: Mapped[str] = mapped_column(String(20), nullable=False)
    requested_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("staff_members.id"))
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

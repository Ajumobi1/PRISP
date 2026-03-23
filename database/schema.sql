CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE task_status AS ENUM (
  'Not Started',
  'In Progress',
  'Awaiting Review',
  'Completed',
  'Delayed'
);

CREATE TYPE task_priority AS ENUM (
  'Urgent/High',
  'Medium',
  'Low'
);

CREATE TYPE cof_status AS ENUM (
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected'
);

CREATE TABLE lgas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lga_code VARCHAR(20) UNIQUE NOT NULL,
  lga_name VARCHAR(120) NOT NULL,
  state_name VARCHAR(120) NOT NULL DEFAULT 'Ondo',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE prs_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code VARCHAR(20) UNIQUE NOT NULL,
  unit_name VARCHAR(120) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code VARCHAR(40) UNIQUE,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) UNIQUE,
  job_title VARCHAR(120),
  unit_id UUID REFERENCES prs_units(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE prs_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number BIGSERIAL UNIQUE NOT NULL,
  unit_id UUID NOT NULL REFERENCES prs_units(id),
  task_description TEXT NOT NULL,
  assignee_id UUID NOT NULL REFERENCES staff_members(id),
  date_assigned DATE NOT NULL,
  due_date DATE NOT NULL,
  status task_status NOT NULL DEFAULT 'Not Started',
  priority task_priority NOT NULL DEFAULT 'Medium',
  remarks TEXT,
  created_by UUID REFERENCES staff_members(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  CONSTRAINT chk_due_after_assigned CHECK (due_date >= date_assigned)
);

CREATE INDEX idx_prs_tasks_status ON prs_tasks(status);
CREATE INDEX idx_prs_tasks_unit ON prs_tasks(unit_id);
CREATE INDEX idx_prs_tasks_assignee ON prs_tasks(assignee_id);
CREATE INDEX idx_prs_tasks_due_date ON prs_tasks(due_date);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES prs_tasks(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  commented_by UUID REFERENCES staff_members(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES prs_tasks(id) ON DELETE CASCADE,
  old_status task_status,
  new_status task_status NOT NULL,
  changed_by UUID REFERENCES staff_members(id),
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_code VARCHAR(40) UNIQUE NOT NULL,
  facility_name VARCHAR(255) NOT NULL,
  ownership_type VARCHAR(50),
  lga_id UUID REFERENCES lgas(id),
  contact_phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollee_number VARCHAR(60) UNIQUE NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  lga_id UUID REFERENCES lgas(id),
  current_facility_id UUID REFERENCES facilities(id),
  enrollment_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE facility_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  report_month DATE NOT NULL,
  service_utilization JSONB NOT NULL,
  encounters_total INTEGER NOT NULL DEFAULT 0,
  disease_surveillance JSONB NOT NULL,
  submitted_by VARCHAR(180),
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approval_status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
  UNIQUE(facility_id, report_month)
);

CREATE TABLE capitation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_month DATE NOT NULL UNIQUE,
  total_beneficiaries INTEGER NOT NULL DEFAULT 0,
  amount_per_beneficiary NUMERIC(14,2) NOT NULL,
  total_disbursed NUMERIC(16,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(40) NOT NULL DEFAULT 'Draft',
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP
);

CREATE TABLE capitation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capitation_cycle_id UUID NOT NULL REFERENCES capitation_cycles(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  gross_amount NUMERIC(14,2) NOT NULL,
  deduction_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL,
  payment_reference VARCHAR(80),
  payment_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(capitation_cycle_id, facility_id)
);

CREATE TABLE cof_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  from_facility_id UUID NOT NULL REFERENCES facilities(id),
  to_facility_id UUID NOT NULL REFERENCES facilities(id),
  reason TEXT NOT NULL,
  request_status cof_status NOT NULL DEFAULT 'Submitted',
  requested_on DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_by UUID REFERENCES staff_members(id),
  approved_on DATE,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_facility_transfer_unique CHECK (from_facility_id <> to_facility_id)
);

CREATE TABLE uhc_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_year INTEGER NOT NULL,
  lga_id UUID NOT NULL REFERENCES lgas(id),
  target_enrollees INTEGER NOT NULL,
  actual_enrollees INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(target_year, lga_id)
);

CREATE TABLE module_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name VARCHAR(80) NOT NULL,
  export_format VARCHAR(20) NOT NULL,
  requested_by UUID REFERENCES staff_members(id),
  storage_path TEXT NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

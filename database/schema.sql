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
  task_title VARCHAR(255) NOT NULL DEFAULT 'Task',
  task_description TEXT NOT NULL,
  assignee_id UUID NOT NULL REFERENCES staff_members(id),
  date_assigned DATE NOT NULL,
  due_date DATE NOT NULL,
  status task_status NOT NULL DEFAULT 'Not Started',
  priority task_priority NOT NULL DEFAULT 'Medium',
  deliverable TEXT,
  checklist TEXT,
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

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES prs_tasks(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

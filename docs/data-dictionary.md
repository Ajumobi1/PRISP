# Unit Task Tracker Data Dictionary

## Core Tables

- `prs_units`: Master list of units (Planning, Research, Statistics, M&E).
- `staff_members`: Staff records used for assignee identity and unit linkage.
- `prs_tasks`: Main tracker table containing serial number, unit, assignee, dates, status, priority, and remarks.

## Supporting Tables

- `task_comments`: Optional comments linked to each task.
- `task_status_history`: Audit log of task status transitions.
- `task_attachments`: Uploaded file metadata for each task (name, content type, size, storage name, upload time).

# PRISP Data Dictionary (Initial)

## PRS Unit Task Tracker

- `prs_units`: Master list of PRS units (Planning, Research, Statistics, M&E).
- `staff_members`: Staff profiles and unit mapping.
- `prs_tasks`: Core spreadsheet-equivalent table with serial number, unit, assignee, dates, status, priority, and remarks.
- `task_comments`: Internal notes/bottlenecks linked to each task.
- `task_status_history`: Auditable timeline of status transitions.

## UHC Strategy Dashboard

- `lgas`: LGA master table for heatmap dimensions.
- `uhc_targets`: Yearly target vs. actual enrollee progress per LGA.

## Monthly Capitation Space

- `capitation_cycles`: Monthly capitation run metadata and totals.
- `capitation_payments`: Facility-level payment line items per cycle.

## Facility Gateway

- `facilities`: Registered hospitals/providers.
- `facility_monthly_reports`: Service utilization, encounters, and disease surveillance submissions.

## Change of Facility (CoF)

- `beneficiaries`: Enrollee records and active facility.
- `cof_requests`: Transfer workflow (submitted -> review -> approved/rejected).

## Reporting / Exports

- `module_exports`: Stores generated report metadata for PDF, Excel, and CSV downloads.

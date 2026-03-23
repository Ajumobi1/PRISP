export type TaskStatus =
  | "Not Started"
  | "In Progress"
  | "Awaiting Review"
  | "Completed"
  | "Delayed";

export type TaskPriority = "Urgent/High" | "Medium" | "Low";

export type UnitName = "Planning" | "Research" | "Statistics" | "M&E";

export interface PRSTask {
  id?: string;
  serialNumber: number;
  unit: UnitName;
  taskTitle: string;
  taskDescription: string;
  assignee: string;
  dateAssigned: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  deliverable: string;
  checklist: string;
  remarks: string;
}

export const statusColumns: TaskStatus[] = [
  "Not Started",
  "In Progress",
  "Awaiting Review",
  "Completed",
  "Delayed",
];

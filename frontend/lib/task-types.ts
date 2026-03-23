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
  taskDescription: string;
  assignee: string;
  dateAssigned: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  remarks: string;
}

export const demoTasks: PRSTask[] = [
  {
    serialNumber: 1,
    unit: "Planning",
    taskDescription: "Prepare Q2 strategic implementation matrix for all 18 LGAs",
    assignee: "A. Olatunji",
    dateAssigned: "2026-03-01",
    dueDate: "2026-03-29",
    status: "In Progress",
    priority: "Urgent/High",
    remarks: "Awaiting final budget sheet from Finance.",
  },
  {
    serialNumber: 2,
    unit: "Research",
    taskDescription: "Conduct rapid policy review for revised capitation methodology",
    assignee: "S. Balogun",
    dateAssigned: "2026-03-04",
    dueDate: "2026-03-25",
    status: "Awaiting Review",
    priority: "Medium",
    remarks: "Draft submitted to Director PRS.",
  },
  {
    serialNumber: 3,
    unit: "Statistics",
    taskDescription: "Validate facility utilization dataset for February report",
    assignee: "R. Ajayi",
    dateAssigned: "2026-03-05",
    dueDate: "2026-03-20",
    status: "Delayed",
    priority: "Urgent/High",
    remarks: "Incomplete submissions from 4 facilities.",
  },
  {
    serialNumber: 4,
    unit: "M&E",
    taskDescription: "Finalize quarterly KPIs and submit board-ready presentation",
    assignee: "M. Adeyemi",
    dateAssigned: "2026-03-08",
    dueDate: "2026-03-30",
    status: "Not Started",
    priority: "Low",
    remarks: "Kickoff meeting scheduled next week.",
  },
  {
    serialNumber: 5,
    unit: "Planning",
    taskDescription: "Update unit workplan tracker for UHC enrollee drive",
    assignee: "D. Ogunleye",
    dateAssigned: "2026-03-10",
    dueDate: "2026-03-23",
    status: "Completed",
    priority: "Medium",
    remarks: "Completed and archived.",
  },
];

export const statusColumns: TaskStatus[] = [
  "Not Started",
  "In Progress",
  "Awaiting Review",
  "Completed",
  "Delayed",
];

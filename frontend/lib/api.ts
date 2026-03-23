import { PRSTask, TaskPriority, TaskStatus, UnitName } from "@/lib/task-types";

const API_BASE = "http://localhost:8000/api/v1";
interface ApiTask {
  id: string;
  serial_number: number;
  unit: string;
  task_description: string;
  assignee: string;
  date_assigned: string;
  due_date: string;
  status: TaskStatus;
  priority: TaskPriority;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskPayload {
  unit: UnitName;
  taskDescription: string;
  assignee: string;
  dateAssigned: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  remarks: string;
}

function toUiTask(task: ApiTask): PRSTask {
  return {
    id: task.id,
    serialNumber: task.serial_number,
    unit: task.unit as UnitName,
    taskDescription: task.task_description,
    assignee: task.assignee,
    dateAssigned: task.date_assigned,
    dueDate: task.due_date,
    status: task.status,
    priority: task.priority,
    remarks: task.remarks ?? "",
  };
}

export async function fetchTasks(): Promise<PRSTask[]> {
  const response = await fetch(`${API_BASE}/tasks`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch tasks");
  }
  const data = (await response.json()) as ApiTask[];
  return data.map(toUiTask);
}

export async function createTask(payload: CreateTaskPayload): Promise<PRSTask> {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      unit: payload.unit,
      task_description: payload.taskDescription,
      assignee: payload.assignee,
      date_assigned: payload.dateAssigned,
      due_date: payload.dueDate,
      status: payload.status,
      priority: payload.priority,
      remarks: payload.remarks,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create task");
  }

  const data = (await response.json()) as ApiTask;
  return toUiTask(data);
}

export async function downloadTasks(format: "csv" | "xlsx" | "pdf"): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/export/${format}`);
  if (!response.ok) {
    throw new Error(`Failed to export ${format}`);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const matchedName = contentDisposition.match(/filename=\"(.+)\"/);
  const filename = matchedName?.[1] ?? `prs-task-tracker.${format}`;

  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}

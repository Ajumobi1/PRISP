import { PRSTask, TaskPriority, TaskStatus, UnitName } from "@/lib/task-types";

const API_BASE = "/api/v1";

interface ApiTask {
  id: string;
  serial_number: number;
  unit: string;
  task_title: string;
  task_description: string;
  assignee: string;
  date_assigned: string;
  due_date: string;
  status: TaskStatus;
  priority: TaskPriority;
  deliverable: string | null;
  checklist: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiTaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface CreateTaskPayload {
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

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await response.json();
      if (body && typeof body.detail === "string" && body.detail.trim()) {
        return body.detail;
      }
    } else {
      const text = await response.text();
      if (text.trim()) {
        return text.trim();
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function toUiAttachment(attachment: ApiTaskAttachment): TaskAttachment {
  return {
    id: attachment.id,
    taskId: attachment.task_id,
    fileName: attachment.file_name,
    contentType: attachment.content_type,
    fileSize: attachment.file_size,
    uploadedAt: attachment.uploaded_at,
  };
}

function toUiTask(task: ApiTask): PRSTask {
  return {
    id: task.id,
    serialNumber: task.serial_number,
    unit: task.unit as UnitName,
    taskTitle: task.task_title,
    taskDescription: task.task_description,
    assignee: task.assignee,
    dateAssigned: task.date_assigned,
    dueDate: task.due_date,
    status: task.status,
    priority: task.priority,
    deliverable: task.deliverable ?? "",
    checklist: task.checklist ?? "",
    remarks: task.remarks ?? "",
  };
}

export async function fetchTasks(): Promise<PRSTask[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/tasks`, { cache: "no-store" });
  } catch {
    throw new Error("Cannot reach backend service. Confirm backend is running and reachable.");
  }

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to fetch tasks"));
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
      task_title: payload.taskTitle,
      task_description: payload.taskDescription,
      assignee: payload.assignee,
      date_assigned: payload.dateAssigned,
      due_date: payload.dueDate,
      status: payload.status,
      priority: payload.priority,
      deliverable: payload.deliverable,
      checklist: payload.checklist,
      remarks: payload.remarks,
    }),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to create task"));
  }

  const data = (await response.json()) as ApiTask;
  return toUiTask(data);
}

export async function updateTask(taskId: string, payload: CreateTaskPayload): Promise<PRSTask> {
  const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      unit: payload.unit,
      task_title: payload.taskTitle,
      task_description: payload.taskDescription,
      assignee: payload.assignee,
      date_assigned: payload.dateAssigned,
      due_date: payload.dueDate,
      status: payload.status,
      priority: payload.priority,
      deliverable: payload.deliverable,
      checklist: payload.checklist,
      remarks: payload.remarks,
    }),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to update task"));
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

export async function uploadTaskAttachments(taskId: string, files: File[]): Promise<TaskAttachment[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to upload task attachments"));
  }

  const data = (await response.json()) as ApiTaskAttachment[];
  return data.map(toUiAttachment);
}

export async function fetchTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(await getApiErrorMessage(response, "Failed to fetch task attachments"));
  }

  const data = (await response.json()) as ApiTaskAttachment[];
  return data.map(toUiAttachment);
}

export function getTaskAttachmentDownloadUrl(taskId: string, attachmentId: string): string {
  return `${API_BASE}/tasks/${taskId}/attachments/${attachmentId}`;
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Failed to delete task attachment"));
  }
}

import { PRSTask, TaskPriority, TaskStatus, UnitName } from "@/lib/task-types";

const TASKS_STORAGE_KEY = "prisp.local.tasks";
const ATTACHMENTS_STORAGE_KEY = "prisp.local.attachments";

interface StoredTask extends PRSTask {
  id: string;
}

interface StoredAttachment {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  dataUrl: string;
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

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

import { generateId } from "./idUtils";

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readTasks(): StoredTask[] {
  const parsed = readJson<StoredTask[]>(TASKS_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveTasks(tasks: StoredTask[]): void {
  writeJson(TASKS_STORAGE_KEY, tasks);
}

function readAttachments(): StoredAttachment[] {
  const parsed = readJson<StoredAttachment[]>(ATTACHMENTS_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveAttachments(attachments: StoredAttachment[]): void {
  writeJson(ATTACHMENTS_STORAGE_KEY, attachments);
}

function toPublicAttachment(attachment: StoredAttachment): TaskAttachment {
  return {
    id: attachment.id,
    taskId: attachment.taskId,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    fileSize: attachment.fileSize,
    uploadedAt: attachment.uploadedAt,
  };
}

function toStoredTask(payload: CreateTaskPayload): StoredTask {
  const tasks = readTasks();
  const nextSerial = tasks.length > 0 ? Math.max(...tasks.map((task) => task.serialNumber)) + 1 : 1;

  return {
    id: generateId("task"),
    serialNumber: nextSerial,
    unit: payload.unit,
    taskTitle: payload.taskTitle,
    taskDescription: payload.taskDescription,
    assignee: payload.assignee,
    dateAssigned: payload.dateAssigned,
    dueDate: payload.dueDate,
    status: payload.status,
    priority: payload.priority,
    deliverable: payload.deliverable,
    checklist: payload.checklist,
    remarks: payload.remarks,
  };
}

function downloadBlob(content: string, contentType: string, filename: string): void {
  if (!isBrowser()) {
    return;
  }

  const blob = new Blob([content], { type: contentType });
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
}

function asCsv(tasks: PRSTask[]): string {
  const headers = [
    "S/N",
    "Unit",
    "Task",
    "Description",
    "Assignee",
    "Start Date",
    "End Date",
    "Status",
    "Priority",
    "Deliverable",
    "Checklist",
    "Remarks",
  ];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = tasks.map((task) => [
    String(task.serialNumber),
    task.unit,
    task.taskTitle,
    task.taskDescription,
    task.assignee,
    task.dateAssigned,
    task.dueDate,
    task.status,
    task.priority,
    task.deliverable,
    task.checklist,
    task.remarks,
  ]);

  return [headers, ...rows].map((row) => row.map((cell) => escape(cell ?? "")).join(",")).join("\n");
}

export async function fetchTasks(): Promise<PRSTask[]> {
  return readTasks().sort((a, b) => a.serialNumber - b.serialNumber);
}

export async function createTask(payload: CreateTaskPayload): Promise<PRSTask> {
  const nextTask = toStoredTask(payload);
  const tasks = readTasks();
  tasks.push(nextTask);
  saveTasks(tasks);
  return nextTask;
}

export async function updateTask(taskId: string, payload: CreateTaskPayload): Promise<PRSTask> {
  const tasks = readTasks();
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index < 0) {
    throw new Error("Task not found.");
  }

  const current = tasks[index];
  const updated: StoredTask = {
    ...current,
    unit: payload.unit,
    taskTitle: payload.taskTitle,
    taskDescription: payload.taskDescription,
    assignee: payload.assignee,
    dateAssigned: payload.dateAssigned,
    dueDate: payload.dueDate,
    status: payload.status,
    priority: payload.priority,
    deliverable: payload.deliverable,
    checklist: payload.checklist,
    remarks: payload.remarks,
  };

  tasks[index] = updated;
  saveTasks(tasks);
  return updated;
}

export async function downloadTasks(format: "csv" | "xlsx" | "pdf"): Promise<void> {
  const tasks = await fetchTasks();
  const now = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    downloadBlob(asCsv(tasks), "text/csv;charset=utf-8", `prs-task-tracker-${now}.csv`);
    return;
  }

  if (format === "xlsx") {
    downloadBlob(asCsv(tasks), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `prs-task-tracker-${now}.xlsx`);
    return;
  }

  const pdfLike = [
    "PRS Task Tracker",
    "",
    ...tasks.map((task) => `${task.serialNumber}. ${task.taskTitle} | ${task.unit} | ${task.assignee} | ${task.status} | ${task.dueDate}`),
  ].join("\n");

  downloadBlob(pdfLike, "application/pdf", `prs-task-tracker-${now}.pdf`);
}

export async function uploadTaskAttachments(taskId: string, files: File[]): Promise<TaskAttachment[]> {
  const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const dataUrls = await Promise.all(files.map((file) => toDataUrl(file)));
  const allAttachments = readAttachments();
  const created: StoredAttachment[] = files.map((file, index) => ({
    id: generateId("attachment"),
    taskId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    dataUrl: dataUrls[index],
  }));

  allAttachments.push(...created);
  saveAttachments(allAttachments);
  return created.map(toPublicAttachment);
}

export async function fetchTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  return readAttachments()
    .filter((attachment) => attachment.taskId === taskId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map(toPublicAttachment);
}

export function getTaskAttachmentDownloadUrl(taskId: string, attachmentId: string): string {
  const attachment = readAttachments().find((entry) => entry.taskId === taskId && entry.id === attachmentId);
  return attachment?.dataUrl ?? "#";
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
  const current = readAttachments();
  const filtered = current.filter((attachment) => !(attachment.taskId === taskId && attachment.id === attachmentId));
  saveAttachments(filtered);
}

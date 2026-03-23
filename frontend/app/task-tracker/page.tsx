"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LayoutGrid, Table as TableIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createTask,
  deleteTaskAttachment,
  downloadTasks,
  fetchTaskAttachments,
  fetchTasks,
  getTaskAttachmentDownloadUrl,
  TaskAttachment,
  uploadTaskAttachments,
} from "@/lib/api";
import { PRSTask, TaskPriority, TaskStatus, UnitName, statusColumns } from "@/lib/task-types";

type ViewMode = "table" | "kanban";

const units: UnitName[] = ["Planning", "Research", "Statistics", "M&E"];
const priorities: TaskPriority[] = ["Urgent/High", "Medium", "Low"];
const assigneeOptions = [
  "A. Olatunji",
  "S. Balogun",
  "R. Ajayi",
  "M. Adeyemi",
  "D. Ogunleye",
  "K. Yusuf",
  "F. Okafor",
];

const priorityClasses: Record<TaskPriority, string> = {
  "Urgent/High": "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const statusVariant: Record<TaskStatus, "secondary" | "warning" | "success" | "destructive" | "default"> = {
  "Not Started": "secondary",
  "In Progress": "default",
  "Awaiting Review": "warning",
  Completed: "success",
  Delayed: "destructive",
};

export default function TaskTrackerPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [tasks, setTasks] = useState<PRSTask[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [taskUploads, setTaskUploads] = useState<Record<string, TaskAttachment[]>>({});
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<PRSTask, "serialNumber">>({
    unit: "Planning",
    taskDescription: "",
    assignee: "",
    dateAssigned: "",
    dueDate: "",
    status: "Not Started",
    priority: "Medium",
    remarks: "",
  });

  const groupedByStatus = useMemo(() => {
    return statusColumns.reduce<Record<TaskStatus, PRSTask[]>>((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {} as Record<TaskStatus, PRSTask[]>);
  }, [tasks]);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setError(null);
        const remoteTasks = await fetchTasks();
        setTasks(remoteTasks);
        const attachmentPairs = await Promise.all(
          remoteTasks.map(async (task) => {
            const taskKey = getTaskKey(task);
            if (!task.id) {
              return [taskKey, []] as const;
            }
            const attachments = await fetchTaskAttachments(task.id);
            return [taskKey, attachments] as const;
          })
        );
        setTaskUploads(Object.fromEntries(attachmentPairs));
      } catch {
        setError("Unable to reach backend API.");
      }
    };

    loadTasks();
  }, []);

  const getTaskKey = (task: PRSTask) => task.id ?? `sn-${task.serialNumber}`;

  const toggleAssignee = (assignee: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(assignee) ? prev.filter((item) => item !== assignee) : [...prev, assignee]
    );
  };

  const onAddTask = async () => {
    if (!form.taskDescription || selectedAssignees.length === 0 || !form.dateAssigned || !form.dueDate) return;

    try {
      setIsBusy(true);
      setError(null);
      const joinedAssignees = selectedAssignees.join(", ");
      const createdTask = await createTask({
        unit: form.unit,
        taskDescription: form.taskDescription,
        assignee: joinedAssignees,
        dateAssigned: form.dateAssigned,
        dueDate: form.dueDate,
        status: form.status,
        priority: form.priority,
        remarks: form.remarks,
      });
      setTasks((prev) => [...prev, createdTask]);
      if (uploadQueue.length > 0 && createdTask.id) {
        const uploadedAttachments = await uploadTaskAttachments(createdTask.id, uploadQueue);
        setTaskUploads((prev) => ({
          ...prev,
          [getTaskKey(createdTask)]: uploadedAttachments,
        }));
      } else {
        setTaskUploads((prev) => ({
          ...prev,
          [getTaskKey(createdTask)]: [],
        }));
      }
      setForm({
        unit: "Planning",
        taskDescription: "",
        assignee: "",
        dateAssigned: "",
        dueDate: "",
        status: "Not Started",
        priority: "Medium",
        remarks: "",
      });
      setSelectedAssignees([]);
      setUploadQueue([]);
    } catch {
      setError("Failed to create task. Check backend/database connection.");
    } finally {
      setIsBusy(false);
    }
  };

  const onDownloadEverything = async () => {
    try {
      setIsBusy(true);
      setError(null);
      await downloadTasks("csv");
      await downloadTasks("xlsx");
      await downloadTasks("pdf");
    } catch {
      setError("Download failed. Confirm export endpoints are reachable.");
    } finally {
      setIsBusy(false);
    }
  };

  const onDeleteAttachment = async (task: PRSTask, attachment: TaskAttachment) => {
    if (!task.id) {
      return;
    }

    const shouldDelete = window.confirm(`Remove attachment \"${attachment.fileName}\"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setDeletingAttachmentId(attachment.id);
      setError(null);
      await deleteTaskAttachment(task.id, attachment.id);
      setTaskUploads((prev) => ({
        ...prev,
        [getTaskKey(task)]: (prev[getTaskKey(task)] ?? []).filter((item) => item.id !== attachment.id),
      }));
    } catch {
      setError("Failed to delete attachment.");
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-[1500px] space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PRS Unit Task Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Spreadsheet-driven operational tracker for Unit Heads and Director of PRS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            onClick={() => setViewMode("table")}
            size="sm"
          >
            <TableIcon className="h-4 w-4" /> Table View
          </Button>
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            onClick={() => setViewMode("kanban")}
            size="sm"
            disabled={isBusy}
          >
            <LayoutGrid className="h-4 w-4" /> Kanban Board
          </Button>
          <Button size="sm" className="gap-2" onClick={onDownloadEverything} disabled={isBusy}>
            <Download className="h-4 w-4" /> Download Everything
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add New Task</CardTitle>
          <CardDescription>Fill all mandatory fields to create a new row in the tracker.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Select value={form.unit} onChange={(event) => setForm((p) => ({ ...p, unit: event.target.value as UnitName }))}>
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>

          <details className="rounded-md border border-input bg-white px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              {selectedAssignees.length > 0
                ? `Assignees (${selectedAssignees.length})`
                : "Select Assignees"}
            </summary>
            <div className="mt-2 max-h-44 space-y-2 overflow-auto pr-1 text-sm">
              {assigneeOptions.map((assignee) => (
                <label key={assignee} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedAssignees.includes(assignee)}
                    onChange={() => toggleAssignee(assignee)}
                  />
                  <span>{assignee}</span>
                </label>
              ))}
            </div>
          </details>

          <Input
            type="date"
            value={form.dateAssigned}
            onChange={(event) => setForm((p) => ({ ...p, dateAssigned: event.target.value }))}
          />

          <Input
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm((p) => ({ ...p, dueDate: event.target.value }))}
          />

          <Select
            value={form.status}
            onChange={(event) => setForm((p) => ({ ...p, status: event.target.value as TaskStatus }))}
          >
            {statusColumns.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>

          <Select
            value={form.priority}
            onChange={(event) => setForm((p) => ({ ...p, priority: event.target.value as TaskPriority }))}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>

          <div className="md:col-span-2 lg:col-span-2">
            <Input
              placeholder="Task Description"
              value={form.taskDescription}
              onChange={(event) => setForm((p) => ({ ...p, taskDescription: event.target.value }))}
            />
          </div>

          <div className="lg:col-span-4">
            <Textarea
              placeholder="Remarks / Comments"
              value={form.remarks}
              onChange={(event) => setForm((p) => ({ ...p, remarks: event.target.value }))}
            />
          </div>

          <div className="lg:col-span-4">
            <Input
              type="file"
              multiple
              onChange={(event) => setUploadQueue(Array.from(event.target.files ?? []))}
            />
            {uploadQueue.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Files ready: {uploadQueue.map((file) => file.name).join(", ")}
              </p>
            ) : null}
          </div>

          <div className="lg:col-span-4 flex justify-end">
            <Button onClick={onAddTask} disabled={isBusy}>{isBusy ? "Working..." : "Add Task Row"}</Button>
          </div>
        </CardContent>
      </Card>

      {viewMode === "table" ? (
        <Card>
          <CardHeader>
            <CardTitle>Spreadsheet View</CardTitle>
            <CardDescription>Professional Google Sheet-like table with all mandated columns.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S/N</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Task Description</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Date Assigned</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Uploaded Files</TableHead>
                  <TableHead>Remarks/Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.serialNumber}>
                    <TableCell className="font-medium">{task.serialNumber}</TableCell>
                    <TableCell>{task.unit}</TableCell>
                    <TableCell className="min-w-[350px]">{task.taskDescription}</TableCell>
                    <TableCell>{task.assignee}</TableCell>
                    <TableCell>{task.dateAssigned}</TableCell>
                    <TableCell>{task.dueDate}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${priorityClasses[task.priority]}`}>
                        {task.priority}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[220px] text-muted-foreground">
                      {(taskUploads[getTaskKey(task)] ?? []).length > 0 ? (
                        <div className="space-y-1">
                          {(taskUploads[getTaskKey(task)] ?? []).map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2">
                              <a
                                href={getTaskAttachmentDownloadUrl(attachment.taskId, attachment.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-xs text-blue-700 underline"
                              >
                                {attachment.fileName}
                              </a>
                              <button
                                type="button"
                                className="text-xs text-red-700 underline disabled:opacity-60"
                                disabled={deletingAttachmentId === attachment.id}
                                onClick={() => onDeleteAttachment(task, attachment)}
                              >
                                {deletingAttachmentId === attachment.id ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="min-w-[280px] text-muted-foreground">{task.remarks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {statusColumns.map((status) => (
            <Card key={status}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{status}</CardTitle>
                <CardDescription>{groupedByStatus[status].length} task(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedByStatus[status].map((task) => (
                  <div key={task.serialNumber} className="rounded-lg border border-border bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">S/N {task.serialNumber}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${priorityClasses[task.priority]}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug">{task.taskDescription}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{task.unit} • {task.assignee}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Due: {task.dueDate}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

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
  updateTask,
  uploadTaskAttachments,
} from "@/lib/api";
import { PRSTask, TaskPriority, TaskStatus, statusColumns } from "@/lib/task-types";

type ViewMode = "table" | "kanban";

const priorities: TaskPriority[] = ["Urgent/High", "Medium", "Low"];

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
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [customMonths, setCustomMonths] = useState<string[]>([]);
  const [closedMonths, setClosedMonths] = useState<string[]>([]);
  const [monthActions, setMonthActions] = useState<Record<string, string>>({});
  const [newMonthInput, setNewMonthInput] = useState<string>(new Date().toISOString().slice(0, 7));
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editMonthInput, setEditMonthInput] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [taskUploads, setTaskUploads] = useState<Record<string, TaskAttachment[]>>({});
  const [uploadQueueByTask, setUploadQueueByTask] = useState<Record<string, File[]>>({});
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PRSTask | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<PRSTask, "serialNumber">>({
    unit: "Planning",
    taskTitle: "",
    taskDescription: "",
    assignee: "",
    dateAssigned: "",
    dueDate: "",
    status: "Not Started",
    priority: "Medium",
    deliverable: "",
    checklist: "",
    remarks: "",
  });

  const groupedByStatus = useMemo(() => {
    const monthTasks = tasks.filter((task) => task.dateAssigned.startsWith(selectedMonth));
    return statusColumns.reduce<Record<TaskStatus, PRSTask[]>>((acc, status) => {
      acc[status] = monthTasks.filter((task) => task.status === status);
      return acc;
    }, {} as Record<TaskStatus, PRSTask[]>);
  }, [tasks, selectedMonth]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.dateAssigned.startsWith(selectedMonth)),
    [tasks, selectedMonth]
  );

  const monthTabs = useMemo(() => {
    const fromTasks = tasks.map((task) => task.dateAssigned.slice(0, 7)).filter(Boolean);
    const merged = Array.from(new Set([...customMonths, ...fromTasks, selectedMonth]));
    return merged
      .filter((month) => !closedMonths.includes(month))
      .sort((a, b) => b.localeCompare(a));
  }, [customMonths, tasks, selectedMonth, closedMonths]);

  const closedMonthTabs = useMemo(() => {
    return [...closedMonths].sort((a, b) => b.localeCompare(a));
  }, [closedMonths]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("prisp.taskTracker.monthTabs");
      const storedClosed = localStorage.getItem("prisp.taskTracker.closedMonths");
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setCustomMonths(parsed.filter((month) => /^\d{4}-\d{2}$/.test(month)));
        }
      }
      if (storedClosed) {
        const parsedClosed = JSON.parse(storedClosed) as string[];
        if (Array.isArray(parsedClosed)) {
          setClosedMonths(parsedClosed.filter((month) => /^\d{4}-\d{2}$/.test(month)));
        }
      }
    } catch {
      // no-op
    }

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

  useEffect(() => {
    localStorage.setItem("prisp.taskTracker.monthTabs", JSON.stringify(customMonths));
  }, [customMonths]);

  useEffect(() => {
    localStorage.setItem("prisp.taskTracker.closedMonths", JSON.stringify(closedMonths));
  }, [closedMonths]);

  const getTaskKey = (task: PRSTask) => task.id ?? `sn-${task.serialNumber}`;

  const formatMonthLabel = (month: string) => {
    const [year, monthPart] = month.split("-");
    const monthIndex = Number(monthPart) - 1;
    const monthName = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ][monthIndex] ?? monthPart;
    return `${monthName} ${year}`;
  };

  const addMonthTab = () => {
    if (!/^\d{4}-\d{2}$/.test(newMonthInput)) {
      setError("Select a valid month.");
      return;
    }
    const [year] = newMonthInput.split("-");
    if (Number(year) < 2000) {
      setError("Month year must be 2000 or later.");
      return;
    }
    setCustomMonths((prev) => (prev.includes(newMonthInput) ? prev : [...prev, newMonthInput]));
    setClosedMonths((prev) => prev.filter((month) => month !== newMonthInput));
    setSelectedMonth(newMonthInput);
    setError(null);
  };

  const startEditMonth = (month: string) => {
    setEditingMonth(month);
    setEditMonthInput(month);
    setError(null);
  };

  const cancelEditMonth = () => {
    setEditingMonth(null);
    setEditMonthInput("");
  };

  const saveEditMonth = () => {
    if (!editingMonth) {
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(editMonthInput)) {
      setError("Select a valid month.");
      return;
    }
    const [year] = editMonthInput.split("-");
    if (Number(year) < 2000) {
      setError("Month year must be 2000 or later.");
      return;
    }
    setCustomMonths((prev) => {
      const withoutOld = prev.filter((month) => month !== editingMonth);
      return withoutOld.includes(editMonthInput) ? withoutOld : [...withoutOld, editMonthInput];
    });
    if (selectedMonth === editingMonth) {
      setSelectedMonth(editMonthInput);
    }
    setEditingMonth(null);
    setEditMonthInput("");
    setError(null);
  };

  const closeMonthTab = (month: string) => {
    const shouldClose = window.confirm("Are you sure you want to close the entire month? (Yes/No)");
    if (!shouldClose) {
      return;
    }

    setClosedMonths((prev) => (prev.includes(month) ? prev : [...prev, month]));

    if (selectedMonth === month) {
      const fallback = monthTabs.find((entry) => entry !== month) ?? new Date().toISOString().slice(0, 7);
      setSelectedMonth(fallback);
    }

    if (editingMonth === month) {
      cancelEditMonth();
    }

    setError(`Month ${formatMonthLabel(month)} is closed. You can reopen it anytime below.`);
  };

  const handleMonthAction = (month: string, action: string) => {
    if (action === "edit") {
      startEditMonth(month);
    }
    if (action === "close") {
      closeMonthTab(month);
    }
    setMonthActions((prev) => ({ ...prev, [month]: "" }));
  };

  const reopenMonthTab = (month: string) => {
    setClosedMonths((prev) => prev.filter((entry) => entry !== month));
    setSelectedMonth(month);
    setError(null);
  };

  const addAssignee = () => {
    const candidate = assigneeInput.trim();
    if (!candidate) {
      return;
    }
    setSelectedAssignees((prev) => {
      if (prev.includes(candidate)) {
        return prev;
      }
      return [...prev, candidate];
    });
    setAssigneeInput("");
  };

  const removeAssignee = (assignee: string) => {
    setSelectedAssignees((prev) => prev.filter((item) => item !== assignee));
  };

  const onAddTask = async () => {
    const normalizedTaskTitle = form.taskTitle.trim();
    const monthStartDefault = `${selectedMonth}-01`;
    const resolvedDateAssigned = form.dateAssigned || monthStartDefault;
    const resolvedDueDate = form.dueDate || resolvedDateAssigned;

    if (!normalizedTaskTitle || selectedAssignees.length === 0) {
      setError("Task, Assignees, Priority, and Status are required.");
      return;
    }

    if (resolvedDueDate < resolvedDateAssigned) {
      setError("End Date cannot be earlier than Start Date.");
      return;
    }

    try {
      setIsBusy(true);
      setError(null);
      const joinedAssignees = selectedAssignees.join(", ");
      const createdTask = await createTask({
        unit: form.unit,
        taskTitle: normalizedTaskTitle,
        taskDescription: form.taskDescription.trim() || normalizedTaskTitle,
        assignee: joinedAssignees,
        dateAssigned: resolvedDateAssigned,
        dueDate: resolvedDueDate,
        status: form.status,
        priority: form.priority,
        deliverable: "",
        checklist: form.checklist,
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
        taskTitle: "",
        taskDescription: "",
        assignee: "",
        dateAssigned: monthStartDefault,
        dueDate: monthStartDefault,
        status: "Not Started",
        priority: "Medium",
        deliverable: "",
        checklist: "",
        remarks: "",
      });
      setSelectedAssignees([]);
      setAssigneeInput("");
      setUploadQueue([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create task.";
      setError(message);
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

  const beginEditTask = (task: PRSTask) => {
    setEditingTaskId(getTaskKey(task));
    setEditDraft({ ...task });
    setError(null);
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditDraft(null);
  };

  const saveEditTask = async (task: PRSTask) => {
    if (!task.id || !editDraft) {
      return;
    }

    const normalizedTitle = editDraft.taskTitle.trim();
    const normalizedAssignee = editDraft.assignee.trim();
    const todayIso = new Date().toISOString().split("T")[0];
    const resolvedStart = editDraft.dateAssigned || todayIso;
    const resolvedEnd = editDraft.dueDate || resolvedStart;

    if (!normalizedTitle || !normalizedAssignee) {
      setError("Task and Assignees are required while editing.");
      return;
    }

    if (resolvedEnd < resolvedStart) {
      setError("End Date cannot be earlier than Start Date.");
      return;
    }

    try {
      setIsBusy(true);
      setError(null);
      const updated = await updateTask(task.id, {
        unit: editDraft.unit,
        taskTitle: normalizedTitle,
        taskDescription: editDraft.taskDescription.trim() || normalizedTitle,
        assignee: normalizedAssignee,
        dateAssigned: resolvedStart,
        dueDate: resolvedEnd,
        status: editDraft.status,
        priority: editDraft.priority,
        deliverable: editDraft.deliverable,
        checklist: editDraft.checklist,
        remarks: editDraft.remarks,
      });

      setTasks((prev) => prev.map((item) => (getTaskKey(item) === getTaskKey(task) ? updated : item)));
      setEditingTaskId(null);
      setEditDraft(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update task.";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  };

  const uploadAttachmentsLater = async (task: PRSTask) => {
    if (!task.id) {
      return;
    }

    const taskKey = getTaskKey(task);
    const queued = uploadQueueByTask[taskKey] ?? [];
    if (queued.length === 0) {
      setError("Select one or more files before uploading.");
      return;
    }

    try {
      setUploadingTaskId(taskKey);
      setError(null);
      const uploaded = await uploadTaskAttachments(task.id, queued);
      setTaskUploads((prev) => ({
        ...prev,
        [taskKey]: [...uploaded, ...(prev[taskKey] ?? [])],
      }));
      setUploadQueueByTask((prev) => ({ ...prev, [taskKey]: [] }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload task attachments.";
      setError(message);
    } finally {
      setUploadingTaskId(null);
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
          <CardDescription>
            Required: Task, Assignees, Status, Priority. Upload files for deliverable is optional. Current sheet: {formatMonthLabel(selectedMonth)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Task (Required)"
            value={form.taskTitle}
            onChange={(event) => setForm((p) => ({ ...p, taskTitle: event.target.value }))}
          />

          <div className="rounded-md border border-input bg-white px-3 py-2">
            <p className="text-sm font-medium">
              {selectedAssignees.length > 0
                ? `Assignees (${selectedAssignees.length})`
                : "Assignees"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                placeholder="Add assignee name (Required)"
                value={assigneeInput}
                onChange={(event) => setAssigneeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addAssignee();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addAssignee}>
                Add
              </Button>
            </div>
            <div className="mt-2">
              {selectedAssignees.length === 0 ? (
                <span className="text-xs text-muted-foreground">No assignees added yet.</span>
              ) : (
                <details className="rounded border border-input px-2 py-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    View added names ({selectedAssignees.length})
                  </summary>
                  <div className="mt-2 max-h-32 space-y-1 overflow-auto">
                    {selectedAssignees.map((assignee) => (
                      <div key={assignee} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
                        <span className="truncate">{assignee}</span>
                        <button
                          type="button"
                          className="text-red-700"
                          onClick={() => removeAssignee(assignee)}
                          title="Remove assignee"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>

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
              placeholder="Task Description (Optional)"
              value={form.taskDescription}
              onChange={(event) => setForm((p) => ({ ...p, taskDescription: event.target.value }))}
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <Input
              type="date"
              value={form.dateAssigned}
              onChange={(event) => setForm((p) => ({ ...p, dateAssigned: event.target.value }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">Start Date (Optional)</p>
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((p) => ({ ...p, dueDate: event.target.value }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">End Date (Optional)</p>
          </div>

          <div className="lg:col-span-4">
            <Textarea
              placeholder="Checklist (Optional)"
              value={form.checklist}
              onChange={(event) => setForm((p) => ({ ...p, checklist: event.target.value }))}
            />
          </div>

          <div className="lg:col-span-4">
            <Textarea
              placeholder="Notes / Remarks (Optional)"
              value={form.remarks}
              onChange={(event) => setForm((p) => ({ ...p, remarks: event.target.value }))}
            />
          </div>

          <div className="lg:col-span-4">
            <p className="mb-1 text-sm font-medium">Upload files for Deliverable (Optional)</p>
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
                  <TableHead>Task</TableHead>
                  <TableHead>Task Description</TableHead>
                  <TableHead>Responsible Person(s)</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Deliverable</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Uploaded Files</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.map((task) => (
                  <TableRow key={task.serialNumber}>
                    <TableCell className="font-medium">{task.serialNumber}</TableCell>
                    <TableCell className="min-w-[180px]">
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Input
                          value={editDraft.taskTitle}
                          onChange={(event) => setEditDraft({ ...editDraft, taskTitle: event.target.value })}
                        />
                      ) : (
                        task.taskTitle
                      )}
                    </TableCell>
                    <TableCell className="min-w-[350px]">
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Input
                          value={editDraft.taskDescription}
                          onChange={(event) => setEditDraft({ ...editDraft, taskDescription: event.target.value })}
                        />
                      ) : (
                        task.taskDescription
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Input
                          value={editDraft.assignee}
                          onChange={(event) => setEditDraft({ ...editDraft, assignee: event.target.value })}
                        />
                      ) : (
                        task.assignee
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Input
                          type="date"
                          value={editDraft.dateAssigned}
                          onChange={(event) => setEditDraft({ ...editDraft, dateAssigned: event.target.value })}
                        />
                      ) : (
                        task.dateAssigned
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Input
                          type="date"
                          value={editDraft.dueDate}
                          onChange={(event) => setEditDraft({ ...editDraft, dueDate: event.target.value })}
                        />
                      ) : (
                        task.dueDate
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Select
                          value={editDraft.status}
                          onChange={(event) => setEditDraft({ ...editDraft, status: event.target.value as TaskStatus })}
                        >
                          {statusColumns.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Select
                          value={editDraft.priority}
                          onChange={(event) => setEditDraft({ ...editDraft, priority: event.target.value as TaskPriority })}
                        >
                          {priorities.map((priority) => (
                            <option key={priority} value={priority}>{priority}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${priorityClasses[task.priority]}`}>
                          {task.priority}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[180px] text-muted-foreground">
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Input
                          value={editDraft.deliverable}
                          onChange={(event) => setEditDraft({ ...editDraft, deliverable: event.target.value })}
                        />
                      ) : (
                        task.deliverable || "—"
                      )}
                    </TableCell>
                    <TableCell className="min-w-[240px] text-muted-foreground">
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Textarea
                          value={editDraft.checklist}
                          onChange={(event) => setEditDraft({ ...editDraft, checklist: event.target.value })}
                        />
                      ) : (
                        task.checklist || "—"
                      )}
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
                      {task.id ? (
                        <div className="mt-2 space-y-1">
                          <Input
                            type="file"
                            multiple
                            onChange={(event) =>
                              setUploadQueueByTask((prev) => ({
                                ...prev,
                                [getTaskKey(task)]: Array.from(event.target.files ?? []),
                              }))
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={uploadingTaskId === getTaskKey(task)}
                            onClick={() => uploadAttachmentsLater(task)}
                          >
                            {uploadingTaskId === getTaskKey(task) ? "Uploading..." : "Upload Later"}
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-[280px] text-muted-foreground">
                      {editingTaskId === getTaskKey(task) && editDraft ? (
                        <Textarea
                          value={editDraft.remarks}
                          onChange={(event) => setEditDraft({ ...editDraft, remarks: event.target.value })}
                        />
                      ) : (
                        task.remarks
                      )}
                      <div className="mt-2 flex gap-2">
                        {editingTaskId === getTaskKey(task) ? (
                          <>
                            <Button type="button" size="sm" onClick={() => saveEditTask(task)} disabled={isBusy}>
                              Save
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={cancelEditTask} disabled={isBusy}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => beginEditTask(task)}>
                            Edit
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
                    <p className="text-xs text-muted-foreground">{task.taskTitle}</p>
                    <p className="text-sm font-medium leading-snug">{task.taskDescription}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{task.assignee}</p>
                    <p className="mt-1 text-xs text-muted-foreground">End: {task.dueDate}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monthly Sheets</CardTitle>
          <CardDescription>Create and switch unlimited month sheets (tabs at the bottom).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {monthTabs.map((month) => (
              <div key={month} className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedMonth === month ? "default" : "outline"}
                  onClick={() => setSelectedMonth(month)}
                >
                  {formatMonthLabel(month)}
                </Button>
                <Select
                  value={monthActions[month] ?? ""}
                  onChange={(event) => handleMonthAction(month, event.target.value)}
                  className="h-8 w-[110px] text-xs"
                >
                  <option value="" disabled>Actions</option>
                  {customMonths.includes(month) ? <option value="edit">Edit</option> : null}
                  <option value="close">Close</option>
                </Select>
              </div>
            ))}
            <div className="ml-2 flex items-center gap-2">
              <Input
                type="month"
                value={newMonthInput}
                onChange={(event) => setNewMonthInput(event.target.value)}
                className="w-[170px]"
                min="2000-01"
              />
              <Button type="button" size="sm" variant="outline" onClick={addMonthTab}>
                Add Month
              </Button>
            </div>
          </div>
          {editingMonth ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Edit month:</span>
              <Input
                type="month"
                value={editMonthInput}
                onChange={(event) => setEditMonthInput(event.target.value)}
                className="w-[170px]"
                min="2000-01"
              />
              <Button type="button" size="sm" onClick={saveEditMonth}>Save Month</Button>
              <Button type="button" size="sm" variant="outline" onClick={cancelEditMonth}>Cancel</Button>
            </div>
          ) : null}

          {closedMonthTabs.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Closed months (reopen anytime):</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {closedMonthTabs.map((month) => (
                  <Button
                    key={month}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => reopenMonthTab(month)}
                  >
                    Reopen {formatMonthLabel(month)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

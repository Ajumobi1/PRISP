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
import { createTask, downloadTasks, fetchTasks } from "@/lib/api";
import { PRSTask, TaskPriority, TaskStatus, UnitName, demoTasks, statusColumns } from "@/lib/task-types";

type ViewMode = "table" | "kanban";

const units: UnitName[] = ["Planning", "Research", "Statistics", "M&E"];
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
  const [tasks, setTasks] = useState<PRSTask[]>(demoTasks);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      } catch {
        setError("Unable to reach backend API. Showing local sample rows.");
      }
    };

    loadTasks();
  }, []);

  const onAddTask = async () => {
    if (!form.taskDescription || !form.assignee || !form.dateAssigned || !form.dueDate) return;

    try {
      setIsBusy(true);
      setError(null);
      const createdTask = await createTask({
        unit: form.unit,
        taskDescription: form.taskDescription,
        assignee: form.assignee,
        dateAssigned: form.dateAssigned,
        dueDate: form.dueDate,
        status: form.status,
        priority: form.priority,
        remarks: form.remarks,
      });
      setTasks((prev) => [...prev, createdTask]);
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

          <Input
            placeholder="Assignee"
            value={form.assignee}
            onChange={(event) => setForm((p) => ({ ...p, assignee: event.target.value }))}
          />

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

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentSession, logoutSession } from "@/lib/auth-api";
import { fetchTasks } from "@/lib/api";
import { PRSTask, TaskStatus, UnitName } from "@/lib/task-types";

const statusVariant: Record<TaskStatus, "secondary" | "warning" | "success" | "destructive" | "default"> = {
  "Not Started": "secondary",
  "In Progress": "default",
  "Awaiting Review": "warning",
  Completed: "success",
  Delayed: "destructive",
};

function formatMonthLabel(month: string) {
  const [year, monthPart] = month.split("-");
  const monthIndex = Number(monthPart) - 1;
  const monthName = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][monthIndex] ?? monthPart;
  return `${monthName} ${year}`;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<PRSTask[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await fetchTasks();
        setTasks(data);
        const session = await getCurrentSession();
        setIsAdmin(session?.role === "admin");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load dashboard data.";
        setError(message);
      }
    };

    load();
  }, []);

  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(tasks.map((task) => task.dateAssigned.slice(0, 7)).filter(Boolean)));
    if (!months.includes(selectedMonth)) {
      months.push(selectedMonth);
    }
    return months.sort((a, b) => b.localeCompare(a));
  }, [tasks, selectedMonth]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.dateAssigned.startsWith(selectedMonth)),
    [tasks, selectedMonth]
  );

  const byStatus = useMemo(() => {
    return {
      total: visibleTasks.length,
      inProgress: visibleTasks.filter((task) => task.status === "In Progress").length,
      awaitingReview: visibleTasks.filter((task) => task.status === "Awaiting Review").length,
      completed: visibleTasks.filter((task) => task.status === "Completed").length,
      delayed: visibleTasks.filter((task) => task.status === "Delayed").length,
    };
  }, [visibleTasks]);

  const byUnit = useMemo(() => {
    const units: UnitName[] = ["Planning", "Research", "Statistics", "M&E"];
    return units.map((unit) => ({
      unit,
      count: visibleTasks.filter((task) => task.unit === unit).length,
    }));
  }, [visibleTasks]);

  const logout = async () => {
    await logoutSession();
    window.location.href = "/login";
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">DG / HOD Dashboard</h1>
            <p className="text-sm text-slate-600">Leadership summary view for Director General and Heads of Department.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
            >
              Home
            </Link>
            <Link
              href="/task-tracker"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Unit Tracker
            </Link>
            {isAdmin ? (
              <Link
                href="/account-admin"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Manage Accounts
              </Link>
            ) : null}
            <button
              onClick={logout}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Month</CardTitle>
            <CardDescription>Filter dashboard metrics by month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-red-600">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="pt-6"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-semibold">{byStatus.total}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-slate-500">In Progress</p><p className="text-2xl font-semibold">{byStatus.inProgress}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-slate-500">Awaiting Review</p><p className="text-2xl font-semibold">{byStatus.awaitingReview}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-slate-500">Completed</p><p className="text-2xl font-semibold">{byStatus.completed}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-slate-500">Delayed</p><p className="text-2xl font-semibold">{byStatus.delayed}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Department Snapshot</CardTitle>
            <CardDescription>Task volume by unit for {formatMonthLabel(selectedMonth)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byUnit.map((entry) => (
                  <TableRow key={entry.unit}>
                    <TableCell>{entry.unit}</TableCell>
                    <TableCell>{entry.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Task Overview</CardTitle>
            <CardDescription>Read-only listing for leadership monitoring.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                      No tasks found for this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleTasks.map((task) => (
                    <TableRow key={task.id ?? `sn-${task.serialNumber}`}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{task.taskTitle}</div>
                        <div className="text-xs text-slate-500">{task.taskDescription}</div>
                      </TableCell>
                      <TableCell>{task.unit}</TableCell>
                      <TableCell>{task.assignee}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
                      </TableCell>
                      <TableCell>{task.dueDate}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

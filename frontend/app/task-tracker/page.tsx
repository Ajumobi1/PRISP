"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LayoutGrid, Table as TableIcon } from "lucide-react";
import Link from "next/link";

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
import { getCurrentSession, logoutSession } from "@/lib/authApi";
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
  // ...existing code...
}

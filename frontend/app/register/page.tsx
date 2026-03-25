"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { readUsers, saveUsers } from "@/lib/clientStorage";
import { generateId } from "@/lib/idUtils";
import { nowIso } from "@/lib/accountTypes";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("Planning");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      // Client-only registration logic
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedEmail = email.trim().toLowerCase();
      if (!fullName.trim() || !normalizedUsername || !normalizedEmail || !password.trim()) {
        throw new Error("Full name, username, email, and password are required.");
      }
      const users = readUsers();
      if (users.some((entry) => entry.username.toLowerCase() === normalizedUsername)) {
        throw new Error("Username already exists.");
      }
      if (users.some((entry) => entry.email.toLowerCase() === normalizedEmail)) {
        throw new Error("Email already exists.");
      }
      const timestamp = nowIso();
      users.push({
        id: generateId("user"),
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        department: department.trim() || "Planning",
        role: "user",
        status: "pending",
        created_at: timestamp,
        updated_at: timestamp,
        password,
      });
      saveUsers(users);
      setMessage("Account submitted. Awaiting admin approval.");
      setFullName("");
      setUsername("");
      setEmail("");
      setDepartment("Planning");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Unable to create account.";
      setError(text);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Create Account</h1>
        <p className="mt-2 text-sm text-slate-600">New accounts require admin approval before login is allowed.</p>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <input
            type="text"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <input
            type="text"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            type="email"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="Planning">Planning</option>
            <option value="Research">Research</option>
            <option value="Statistics">Statistics</option>
            <option value="M&E">M&E</option>
            <option value="Administration">Administration</option>
          </select>
          <input
            type="password"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <input
            type="password"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit For Approval"}
          </button>
        </form>

        <div className="mt-4 grid gap-2">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}

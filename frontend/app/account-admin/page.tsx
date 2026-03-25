"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AccountStatus, AccountUser, fetchAdminUsers, getCurrentSession, logoutSession, updateAdminUserStatus } from "@/lib/authApi";

const orderedStatus: AccountStatus[] = ["pending", "approved", "locked", "declined"];

export default function AccountAdminPage() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) {
          window.location.href = "/login?next=/account-admin";
          return;
        }

        if (session.role !== "admin") {
          window.location.href = "/task-tracker";
          return;
        }

        setSessionChecked(true);
        const fetched = await fetchAdminUsers();
        setUsers(fetched);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load users.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const grouped = useMemo(() => {
    return orderedStatus.map((status) => ({
      status,
      users: users.filter((user) => user.status === status),
    }));
  }, [users]);

  const updateStatus = async (user: AccountUser, status: AccountStatus) => {
    try {
      setBusyUserId(user.id);
      setError(null);
      const updated = await updateAdminUserStatus(user.id, status);
      setUsers((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update account status.";
      setError(message);
    } finally {
      setBusyUserId(null);
    }
  };

  const signOut = async () => {
    await logoutSession();
    window.location.href = "/login";
  };

  if (!sessionChecked && isLoading) {
    return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-5xl text-sm text-slate-600">Loading account administration...</div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <img src="/odchc-logo.svg" alt="ODCHC logo" className="h-14 w-14 rounded-full border border-slate-200 bg-white p-1 shadow-sm" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Portal Admin</p>
                <h1 className="text-2xl font-semibold text-slate-900">Account Administration</h1>
                <p className="text-sm text-slate-600">Approve, decline, lock, and unlock user access securely.</p>
              </div>
              <img src="/odchc-logo.svg" alt="ODCHC logo" className="h-14 w-14 rounded-full border border-slate-200 bg-white p-1 shadow-sm" />
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Dashboard
              </Link>
              <button
                onClick={signOut}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading users...</div>
        ) : (
          <div className="grid gap-4">
            {grouped.map((entry) => (
              <section key={entry.status} className="rounded-lg border border-slate-200 bg-white">
                <header className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{entry.status} ({entry.users.length})</h2>
                </header>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Username</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Department</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Role</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {entry.users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-center text-slate-500">No users in this state.</td>
                        </tr>
                      ) : (
                        entry.users.map((user) => (
                          <tr key={user.id}>
                            <td className="px-4 py-2">{user.full_name}</td>
                            <td className="px-4 py-2">{user.username}</td>
                            <td className="px-4 py-2">{user.department}</td>
                            <td className="px-4 py-2">{user.role}</td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-2">
                                {entry.status !== "approved" ? (
                                  <button
                                    onClick={() => updateStatus(user, "approved")}
                                    disabled={busyUserId === user.id}
                                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                                  >
                                    Approve
                                  </button>
                                ) : null}
                                {entry.status !== "declined" ? (
                                  <button
                                    onClick={() => updateStatus(user, "declined")}
                                    disabled={busyUserId === user.id}
                                    className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                                  >
                                    Decline
                                  </button>
                                ) : null}
                                {entry.status !== "locked" ? (
                                  <button
                                    onClick={() => updateStatus(user, "locked")}
                                    disabled={busyUserId === user.id}
                                    className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                                  >
                                    Lock
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => updateStatus(user, "approved")}
                                    disabled={busyUserId === user.id}
                                    className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                                  >
                                    Unlock
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

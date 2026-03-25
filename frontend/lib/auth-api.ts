export type AccountRole = "user" | "admin";
export type AccountStatus = "pending" | "approved" | "declined" | "locked";

export interface SessionUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  department: string;
  role: AccountRole;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface AccountUser extends SessionUser {}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
  return payload?.detail || fallback;
}

export async function loginSession(username: string, password: string) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Unable to login"));
  }

  return (await response.json()) as {
    username: string;
    full_name: string;
    role: AccountRole;
  };
}

export async function logoutSession(): Promise<void> {
  await fetch("/api/session", { method: "DELETE" });
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await readError(response, "Unable to verify session"));
  }
  return (await response.json()) as SessionUser;
}

export async function registerAccount(payload: {
  fullName: string;
  username: string;
  email: string;
  department: string;
  password: string;
}): Promise<string> {
  const response = await fetch("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: payload.fullName,
      username: payload.username,
      email: payload.email,
      department: payload.department,
      password: payload.password,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Unable to submit registration"));
  }

  const data = (await response.json()) as { detail?: string };
  return data.detail || "Account submitted.";
}

export async function fetchAdminUsers(): Promise<AccountUser[]> {
  const response = await fetch("/api/admin-users", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readError(response, "Unable to fetch users"));
  }
  return (await response.json()) as AccountUser[];
}

export async function updateAdminUserStatus(userId: string, status: AccountStatus): Promise<AccountUser> {
  const response = await fetch(`/api/admin-users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Unable to update account status"));
  }

  return (await response.json()) as AccountUser;
}

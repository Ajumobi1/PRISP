// Universal types and helpers for accounts
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

export interface StoredUser extends SessionUser {
  password: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// Universal account logic (safe for SSR)
import type { AccountStatus, AccountUser, SessionUser, StoredUser } from "./accountTypes";
import { nowIso } from "./accountTypes";
import { generateId } from "./idUtils";

export function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    full_name: user.full_name,
    username: user.username,
    email: user.email,
    department: user.department,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function createAdminUser(): StoredUser {
  const timestamp = nowIso();
  return {
    id: generateId("user"),
    full_name: "System Admin",
    username: "admin",
    email: "admin@local.prisp",
    department: "Administration",
    role: "admin",
    status: "approved",
    created_at: timestamp,
    updated_at: timestamp,
    password: "admin",
  };
}

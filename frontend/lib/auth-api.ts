export type AccountRole = "user" | "admin";
export type AccountStatus = "pending" | "approved" | "declined" | "locked";

const USERS_STORAGE_KEY = "prisp.local.users";
const SESSION_STORAGE_KEY = "prisp.local.session.userId";

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

interface StoredUser extends SessionUser {
  password: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function nowIso(): string {
  return new Date().toISOString();
}

import { generateId } from "./idUtils";

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readUsers(): StoredUser[] {
  const users = readJson<StoredUser[]>(USERS_STORAGE_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users: StoredUser[]): void {
  writeJson(USERS_STORAGE_KEY, users);
}

function toSessionUser(user: StoredUser): SessionUser {
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

function seedAdminIfNeeded(): void {
  const users = readUsers();
  if (users.some((user) => user.role === "admin")) {
    return;
  }

  const timestamp = nowIso();
  const admin: StoredUser = {
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

  saveUsers([admin]);
}

function getCurrentUserId(): string | null {
  if (!isBrowser()) {
    return null;
  }
  seedAdminIfNeeded();
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function requireAdmin(): StoredUser {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error("Not authenticated.");
  }

  const user = readUsers().find((entry) => entry.id === userId);
  if (!user || user.role !== "admin") {
    throw new Error("Admin access required.");
  }

  return user;
}

export async function loginSession(username: string, password: string) {
  seedAdminIfNeeded();

  const user = readUsers().find((entry) => entry.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || user.password !== password) {
    throw new Error("Invalid username or password.");
  }

  if (user.status === "pending") {
    throw new Error("Account is pending admin approval.");
  }
  if (user.status === "declined") {
    throw new Error("Account has been declined by admin.");
  }
  if (user.status === "locked") {
    throw new Error("Account is locked by admin.");
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, user.id);

  return {
    username: user.username,
    full_name: user.full_name,
    role: user.role,
  };
}

export async function logoutSession(): Promise<void> {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  seedAdminIfNeeded();

  const userId = getCurrentUserId();
  if (!userId) {
    return null;
  }

  const user = readUsers().find((entry) => entry.id === userId);
  return user ? toSessionUser(user) : null;
}

export async function registerAccount(payload: {
  fullName: string;
  username: string;
  email: string;
  department: string;
  password: string;
}): Promise<string> {
  seedAdminIfNeeded();

  const normalizedUsername = payload.username.trim().toLowerCase();
  const normalizedEmail = payload.email.trim().toLowerCase();
  if (!normalizedUsername || !normalizedEmail || !payload.password.trim()) {
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
  const created: StoredUser = {
    id: generateId("user"),
    full_name: payload.fullName.trim(),
    username: payload.username.trim(),
    email: payload.email.trim(),
    department: payload.department.trim() || "Planning",
    role: "user",
    status: "pending",
    created_at: timestamp,
    updated_at: timestamp,
    password: payload.password,
  };

  users.push(created);
  saveUsers(users);

  return "Account submitted. Awaiting admin approval.";
}

export async function fetchAdminUsers(): Promise<AccountUser[]> {
  requireAdmin();
  seedAdminIfNeeded();

  return readUsers()
    .map((user) => toSessionUser(user))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function updateAdminUserStatus(userId: string, status: AccountStatus): Promise<AccountUser> {
  const adminUser = requireAdmin();
  const users = readUsers();
  const index = users.findIndex((entry) => entry.id === userId);

  if (index < 0) {
    throw new Error("User not found.");
  }

  if (users[index].id === adminUser.id && status !== "approved") {
    throw new Error("Admin account cannot be declined or locked.");
  }

  users[index] = {
    ...users[index],
    status,
    updated_at: nowIso(),
  };

  saveUsers(users);
  return toSessionUser(users[index]);
}

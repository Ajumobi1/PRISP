// Client-only storage helpers for Next.js (safe for browser only)
import { StoredUser } from "./accountTypes";

const USERS_STORAGE_KEY = "prisp.local.users";
const SESSION_STORAGE_KEY = "prisp.local.session.userId";

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readUsers(): StoredUser[] {
  const users = readJson<StoredUser[]>(USERS_STORAGE_KEY, []);
  return Array.isArray(users) ? users : [];
}

export function saveUsers(users: StoredUser[]): void {
  writeJson(USERS_STORAGE_KEY, users);
}

export function getCurrentUserId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export function setCurrentUserId(userId: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, userId);
}

export function clearCurrentUserId(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

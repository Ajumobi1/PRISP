import { NextResponse } from "next/server";

const DASHBOARD_COOKIE = "prisp_dashboard_auth";

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const MAX_FAILED_ATTEMPTS = toPositiveInt(process.env.DASHBOARD_MAX_ATTEMPTS, 5);
const ATTEMPT_WINDOW_MINUTES = toPositiveInt(process.env.DASHBOARD_ATTEMPT_WINDOW_MINUTES, 15);
const LOCKOUT_MINUTES = toPositiveInt(process.env.DASHBOARD_LOCKOUT_MINUTES, 15);
const ATTEMPT_WINDOW_MS = ATTEMPT_WINDOW_MINUTES * 60 * 1000;
const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;

type AttemptState = {
  count: number;
  firstFailureAt: number;
  lockedUntil: number;
};

const attemptStore = new Map<string, AttemptState>();

function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return `ip:${firstIp}`;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return `ip:${realIp}`;
  }

  return "ip:unknown";
}

function getOrInitAttemptState(key: string, now: number): AttemptState {
  const existing = attemptStore.get(key);
  if (!existing) {
    const created: AttemptState = {
      count: 0,
      firstFailureAt: now,
      lockedUntil: 0,
    };
    attemptStore.set(key, created);
    return created;
  }

  if (now - existing.firstFailureAt > ATTEMPT_WINDOW_MS) {
    existing.count = 0;
    existing.firstFailureAt = now;
    existing.lockedUntil = 0;
  }

  return existing;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const submitted = body?.code?.trim() ?? "";
  const expected = process.env.DASHBOARD_ACCESS_CODE?.trim() ?? "";
  const key = getClientKey(request);
  const now = Date.now();
  const attempts = getOrInitAttemptState(key, now);

  if (attempts.lockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((attempts.lockedUntil - now) / 1000));
    return NextResponse.json(
      { detail: `Too many failed attempts. Try again in ${retryAfterSeconds} seconds.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  if (!expected) {
    return NextResponse.json(
      { detail: "Dashboard access code is not configured on the server." },
      { status: 500 }
    );
  }

  if (!submitted || submitted !== expected) {
    attempts.count += 1;
    if (attempts.count === 1) {
      attempts.firstFailureAt = now;
    }

    if (attempts.count >= MAX_FAILED_ATTEMPTS) {
      attempts.lockedUntil = now + LOCKOUT_MS;
      attempts.count = 0;
      attempts.firstFailureAt = now;
      const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
      return NextResponse.json(
        { detail: `Too many failed attempts. Try again in ${retryAfterSeconds} seconds.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }

    return NextResponse.json({ detail: "Invalid access code." }, { status: 401 });
  }

  attemptStore.delete(key);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DASHBOARD_COOKIE,
    value: "ok",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DASHBOARD_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

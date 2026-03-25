import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "prisp_auth_token";
const ROLE_COOKIE = "prisp_auth_role";
const BACKEND_BASE = (process.env.BACKEND_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  role: "user" | "admin";
  username: string;
  full_name: string;
};

function clearSessionCookies(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: ROLE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;

  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ detail: "Username and password are required." }, { status: 400 });
  }

  const response = await fetch(`${BACKEND_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    return NextResponse.json(
      { detail: payload?.detail || "Login failed." },
      { status: response.status }
    );
  }

  const payload = (await response.json()) as LoginResponse;
  const nextResponse = NextResponse.json({
    username: payload.username,
    full_name: payload.full_name,
    role: payload.role,
  });

  nextResponse.cookies.set({
    name: AUTH_COOKIE,
    value: payload.access_token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  nextResponse.cookies.set({
    name: ROLE_COOKIE,
    value: payload.role,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return nextResponse;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const response = await fetch(`${BACKEND_BASE}/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const nextResponse = NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    clearSessionCookies(nextResponse);
    return nextResponse;
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (token) {
    await fetch(`${BACKEND_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "prisp_auth_token";
const BACKEND_BASE = (process.env.BACKEND_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const response = await fetch(`${BACKEND_BASE}/auth/admin/users`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json({ detail: payload?.detail || "Failed to fetch users" }, { status: response.status });
  }

  return NextResponse.json(payload);
}

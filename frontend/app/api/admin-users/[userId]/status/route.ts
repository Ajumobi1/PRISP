import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "prisp_auth_token";
const BACKEND_BASE = (process.env.BACKEND_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status?.trim();

  if (!status) {
    return NextResponse.json({ detail: "Status is required" }, { status: 400 });
  }

  const response = await fetch(`${BACKEND_BASE}/auth/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json({ detail: payload?.detail || "Failed to update user" }, { status: response.status });
  }

  return NextResponse.json(payload);
}

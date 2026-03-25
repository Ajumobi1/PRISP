import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "prisp_auth_token";
const ROLE_COOKIE = "prisp_auth_role";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/dashboard/login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", "/dashboard");
    return NextResponse.redirect(loginUrl);
  }

  const requiresAuth =
    pathname.startsWith("/task-tracker") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/account-admin");

  if (!requiresAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/account-admin")) {
    const role = request.cookies.get(ROLE_COOKIE)?.value;
    if (role !== "admin") {
      const fallback = request.nextUrl.clone();
      fallback.pathname = "/task-tracker";
      fallback.search = "";
      return NextResponse.redirect(fallback);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/task-tracker/:path*", "/dashboard/:path*", "/client/:path*", "/account-admin/:path*"],
};

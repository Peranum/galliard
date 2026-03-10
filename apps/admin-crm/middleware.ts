import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth") || pathname === "/api/healthz" || pathname === "/login") {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_SESSION_SECRET ?? "dev-session-secret";
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (cookie === expected) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "не авторизован" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"]
};

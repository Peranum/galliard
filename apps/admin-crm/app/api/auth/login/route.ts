import { NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "admin123";

  if (!body?.password || body.password !== expectedPassword) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, process.env.ADMIN_SESSION_SECRET ?? "dev-session-secret", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return response;
}

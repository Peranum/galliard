import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://backend:8080";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN ?? "dev-admin-token";

async function proxy(request: NextRequest, method: string, params: Promise<{ path: string[] }>) {
  const { path } = await params;
  // Defensive normalization: accept both /api/foo and accidental /api/api/foo.
  const normalizedPath = path[0] === "api" ? path.slice(1) : path;
  const suffix = normalizedPath.join("/");
  const url = new URL(`${BACKEND_URL}/api/${suffix}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers();
  headers.set("X-Admin-Token", ADMIN_API_TOKEN);
  headers.set("Content-Type", "application/json");

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store"
  };

  if (method !== "GET") {
    const bodyText = await request.text();
    if (bodyText) {
      init.body = bodyText;
    }
  }

  const response = await fetch(url, init);
  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json"
    }
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, "GET", context.params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, "POST", context.params);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, "PATCH", context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, "DELETE", context.params);
}

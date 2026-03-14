import { NextResponse } from "next/server";

interface LeadPayload {
  name: string;
  company: string;
  phone: string;
  email?: string;
  message: string;
  contactType: "call" | "telegram";
}

interface ClientMeta {
  ip?: string;
  userAgent?: string;
  deviceType?: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  browser?: string;
  os?: string;
  language?: string;
  referer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

function firstNonEmpty(...values: Array<string | null>): string | undefined {
  for (const value of values) {
    if (!value) {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed !== "") {
      return trimmed;
    }
  }
  return undefined;
}

function detectDeviceType(userAgent?: string): ClientMeta["deviceType"] {
  if (!userAgent) {
    return "unknown";
  }
  const ua = userAgent.toLowerCase();
  if (/(bot|crawler|spider|slurp|bingpreview)/.test(ua)) {
    return "bot";
  }
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(userAgent)) {
    return "tablet";
  }
  if (/(mobile|iphone|ipod|android|blackberry|iemobile|opera mini)/i.test(userAgent)) {
    return "mobile";
  }
  return "desktop";
}

function detectBrowser(userAgent?: string): string | undefined {
  if (!userAgent) {
    return undefined;
  }
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/OPR\//.test(userAgent)) return "Opera";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";
  return "Other";
}

function detectOS(userAgent?: string): string | undefined {
  if (!userAgent) {
    return undefined;
  }
  if (/Windows NT/i.test(userAgent)) return "Windows";
  if (/Mac OS X/i.test(userAgent) && !/(iPhone|iPad|iPod)/i.test(userAgent)) return "macOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/(iPhone|iPad|iPod)/i.test(userAgent)) return "iOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Other";
}

function extractIp(headers: Headers): string | undefined {
  const xff = firstNonEmpty(headers.get("x-forwarded-for"));
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return firstNonEmpty(
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("x-client-ip"),
    headers.get("x-forwarded")
  );
}

function parseUtmFromReferer(referer?: string): Partial<ClientMeta> {
  if (!referer) {
    return {};
  }
  try {
    const url = new URL(referer);
    const get = (key: string) => {
      const value = url.searchParams.get(key);
      return value && value.trim() !== "" ? value.trim() : undefined;
    };
    return {
      utmSource: get("utm_source"),
      utmMedium: get("utm_medium"),
      utmCampaign: get("utm_campaign"),
      utmContent: get("utm_content"),
      utmTerm: get("utm_term")
    };
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as LeadPayload;

  const userAgent = firstNonEmpty(request.headers.get("user-agent"));
  const referer = firstNonEmpty(request.headers.get("referer"));
  const languageHeader = firstNonEmpty(request.headers.get("accept-language"));
  const language = languageHeader?.split(",")[0]?.trim();

  const metadata: ClientMeta = {
    ip: extractIp(request.headers),
    userAgent,
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOS(userAgent),
    language,
    referer,
    ...parseUtmFromReferer(referer)
  };

  const backendResponse = await fetch(`${BACKEND_URL}/api/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: payload.name,
      company: payload.company,
      phone: payload.phone,
      email: payload.email,
      message: payload.message,
      contactType: payload.contactType,
      source: "landing",
      metadata
    })
  });

  if (!backendResponse.ok) {
    const backendError = await backendResponse.json().catch(() => null);
    return NextResponse.json(
      { error: backendError?.error ?? "Ошибка создания лида." },
      { status: 502 }
    );
  }

  if (BOT_TOKEN && CHAT_ID) {
    const text = [
      "Новая заявка с сайта",
      `Имя: ${payload.name}`,
      `Компания: ${payload.company}`,
      `Телефон: ${payload.phone}`,
      payload.email ? `Email: ${payload.email}` : "Email: —",
      `Способ связи: ${payload.contactType === "call" ? "Звонок" : "Telegram"}`,
      `Комментарий: ${payload.message}`,
      "",
      "Тех. данные:",
      `IP: ${metadata.ip ?? "—"}`,
      `Устройство: ${metadata.deviceType ?? "—"}`,
      `Браузер: ${metadata.browser ?? "—"}`,
      `ОС: ${metadata.os ?? "—"}`,
      `Язык: ${metadata.language ?? "—"}`,
      `Referer: ${metadata.referer ?? "—"}`,
      `UTM: ${[metadata.utmSource, metadata.utmMedium, metadata.utmCampaign].filter(Boolean).join(" / ") || "—"}`
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text
      })
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

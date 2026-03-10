import { NextResponse } from "next/server";

interface LeadPayload {
  name: string;
  company: string;
  phone: string;
  email?: string;
  message: string;
  contactType: "call" | "telegram";
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(request: Request) {
  const payload = (await request.json()) as LeadPayload;

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
      source: "landing"
    })
  });

  if (!backendResponse.ok) {
    const backendError = await backendResponse.json().catch(() => null);
    return NextResponse.json(
      { error: backendError?.error ?? "Ошибка создания лида." },
      { status: 502 }
    );
  }

  // Optional duplicate Telegram notify for operators.
  if (BOT_TOKEN && CHAT_ID) {
    const text = [
      "Новая заявка с сайта",
      `Имя: ${payload.name}`,
      `Компания: ${payload.company}`,
      `Телефон: ${payload.phone}`,
      payload.email ? `Email: ${payload.email}` : "Email: —",
      `Способ связи: ${payload.contactType === "call" ? "Звонок" : "Telegram"}`,
      `Комментарий: ${payload.message}`
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

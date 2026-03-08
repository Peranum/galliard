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

export async function POST(request: Request) {
  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({ error: "Telegram bot не настроен." }, { status: 500 });
  }

  const payload = (await request.json()) as LeadPayload;

  const text = [
    "Новая заявка с сайта",
    `Имя: ${payload.name}`,
    `Компания: ${payload.company}`,
    `Телефон: ${payload.phone}`,
    payload.email ? `Email: ${payload.email}` : "Email: —",
    `Способ связи: ${payload.contactType === "call" ? "Звонок" : "Telegram"}`,
    `Комментарий: ${payload.message}`
  ].join("\n");

  const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text
    })
  });

  if (!telegramResponse.ok) {
    const telegramError = await telegramResponse.json().catch(() => null);
    return NextResponse.json(
      { error: telegramError?.description ?? "Ошибка отправки в Telegram." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

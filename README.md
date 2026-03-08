# Сайт-визитка импортной компании

Одностраничный адаптивный сайт на Next.js (App Router + TypeScript + SCSS Modules) с формой заявки на консультацию.

## Запуск

```bash
npm install
npm run dev
```

Открыть: http://localhost:3000

## Скрипты

- `npm run dev` — разработка
- `npm run build` — production build
- `npm run start` — запуск production
- `npm run lint` — линтинг
- `npm run typecheck` — проверка TypeScript

## Telegram env

Для отправки заявок в Telegram заполните `.env`:

```bash
cp .env.example .env
```

Переменные:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## Docker

```bash
docker compose up -d --build
```

Остановить:

```bash
docker compose down
```

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

`docker compose` автоматически подхватит значения из файла `.env` в корне проекта.

## Docker

```bash
docker compose up -d --build
```

Остановить:

```bash
docker compose down
```

### Домен `galliard.by` + HTTPS

В `docker-compose` уже добавлен `caddy`, который автоматически получает TLS-сертификаты для:

- `galliard.by`
- `www.galliard.by`

Нужно сделать на DNS:

- `A` запись `galliard.by` -> IP вашего сервера
- `A` запись `www.galliard.by` -> IP вашего сервера

И на сервере открыть порты:

- `80/tcp`
- `443/tcp`

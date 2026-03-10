# Galliard Monorepo

MVP CRM stack:
- `apps/landing` — публичный лендинг
- `apps/admin-crm` — админка CRM (Dashboard, Leads, Pipeline, Clients, Campaigns, Tasks)
- `services/backend` — Go API + Postgres
- `services/mailer` — Go SMTP worker (Mailcow)
- `packages/shared` — общие TS типы

## Environment

```bash
cp .env.example .env
```

Ключевые переменные:
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `ADMIN_API_TOKEN`
- `POSTGRES_*`
- `SMTP_*`

## Start (Docker)

```bash
docker compose up -d --build
```

Endpoints:
- Landing: `https://galliard.by` / `http://localhost:8088`
- Admin: `https://admin.galliard.by` / `http://localhost:8089`

## Health endpoints

- Backend: `GET /healthz`
- Landing: `GET /api/healthz`
- Admin CRM: `GET /api/healthz`

## Zero-downtime baseline

В репозитории подготовлен baseline для zero-downtime rollout stateless-сервисов:
- убраны `container_name` (можно масштабировать сервисы)
- добавлены `healthcheck`
- добавлены `stop_grace_period` + `init: true`
- backend завершает работу gracefully по `SIGTERM`
- Caddy использует health-aware reverse proxy

### Важно

- Реальный zero-downtime для БД недостижим на single-node Postgres.
- Для production zero-downtime БД нужна HA Postgres (managed сервис/кластер).

## Рекомендуемый rollout (CI/CD)

1. Собрать новые образы:
```bash
docker compose build backend landing admin-crm
```

2. Поднять минимум 2 реплики stateless-сервисов:
```bash
docker compose up -d --scale backend=2 --scale landing=2 --scale admin-crm=2
```

3. Обновить сервисы без остановки всего стека:
```bash
docker compose up -d --no-deps backend landing admin-crm
```

4. Проверить состояние:
```bash
docker compose ps
docker compose logs --tail=100 caddy
```

5. При необходимости вернуть 1 реплику после деплоя:
```bash
docker compose up -d --scale backend=1 --scale landing=1 --scale admin-crm=1
```

## Local FE dev

```bash
npm install
npm run dev:landing
npm run dev:admin
```

## Acceptance smoke-checks

1. Submit landing form: creates lead in DB + task + activity.
2. Login admin (`ADMIN_PASSWORD`) and open Dashboard.
3. Leads Base: quick add, search/filter/sort, stage update.
4. Pipeline: drag lead between columns and verify stage change.
5. Clients: lead appears after `SOURCING` stage.
6. Campaign start: queue is created in `campaign_messages`.
7. In Campaigns screen, manually mark message as `replied/bounced/unsubscribed` and check stats update.

## Mailcow setup (same server, no downtime for CRM)

Ниже схема, которая не конфликтует с текущим Caddy/CRM стеком:
- Mailcow обслуживает SMTP/IMAP порты напрямую (`25/465/587/993/...`).
- Web UI Mailcow работает локально на `127.0.0.1:8080`.
- Публичный HTTPS для `mail.galliard.by` отдает Caddy (reverse proxy -> `127.0.0.1:8080`).

### 1) DNS записи

Минимально для домена `galliard.by`:
- `A mail.galliard.by -> <SERVER_IP>`
- `A autodiscover.galliard.by -> <SERVER_IP>`
- `A autoconfig.galliard.by -> <SERVER_IP>`
- `MX galliard.by -> mail.galliard.by` (priority `10`)
- `TXT @ -> v=spf1 mx -all` (или `ip4:<SERVER_IP>`)
- `TXT _dmarc -> v=DMARC1; p=none; rua=mailto:postmaster@galliard.by`
- DKIM TXT добавляется после генерации ключа в Mailcow.

### 2) Установка Mailcow

```bash
cd /opt
git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized
./generate_config.sh
```

В `mailcow.conf` выставить:

```bash
MAILCOW_HOSTNAME=mail.galliard.by
ADDITIONAL_SERVER_NAMES=autodiscover.galliard.by autoconfig.galliard.by
SKIP_LETS_ENCRYPT=y
HTTP_BIND=127.0.0.1
HTTP_PORT=8080
HTTPS_BIND=127.0.0.1
HTTPS_PORT=8443
```

Запуск:

```bash
docker compose up -d
```

### 3) Применить Caddy конфиг из этого репозитория

В этом репо уже добавлен блок:
- `mail.galliard.by`
- `autodiscover.galliard.by`
- `autoconfig.galliard.by`

Перезапуск Caddy:

```bash
cd /path/to/galliard
docker compose up -d caddy
```

### 4) Создать почтовый ящик `info@galliard.by`

1. Открыть `https://mail.galliard.by`
2. Войти админом Mailcow
3. `Configuration -> Mail Setup -> Domains` (добавить `galliard.by`, если нет)
4. `Mail Setup -> Mailboxes -> Add mailbox`
5. `Local part: info`, `Domain: galliard.by`, задать пароль
6. Сохранить

### 5) Проверка

- Webmail: `https://mail.galliard.by/SOGo/`
- SMTP submission: `mail.galliard.by:587`
- IMAPS: `mail.galliard.by:993`

### Важно

- Не публикуй `8080/8443` Mailcow наружу (оставь bind на `127.0.0.1`).
- Для лучшей доставляемости добавь PTR (reverse DNS) на `mail.galliard.by`.
- Для production лучше `DMARC p=quarantine/reject` после прогрева и проверки.

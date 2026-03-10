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

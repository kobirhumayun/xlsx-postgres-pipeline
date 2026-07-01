# XLSX Postgres Pipeline

A Next.js application for importing Excel files into PostgreSQL tables, running
raw SQL queries, exporting query results to Excel, and managing database
backups.

This project is designed as a trusted single-user/operator tool. It does not
include built-in authentication.

## Features

- Flexible Excel import into selected PostgreSQL tables.
- Simple table creation from Excel headers.
- Database, table, and column discovery.
- Raw SQL editor with preview results.
- Excel export for query results.
- Saved SQL queries.
- Manual backup and restore UI.
- Dockerized development and production flows.

## Documentation

Codex project instructions start in [AGENTS.md](./AGENTS.md).

Architecture and handoff docs live in [architecture](./architecture).

Documentation read order:

- [Codex Project Instructions](./AGENTS.md)
- [Architecture Index](./architecture/README.md)
- [Project Overview](./architecture/00_PROJECT_OVERVIEW.md)
- [Codex Handoff](./architecture/09_CODEX_HANDOFF.md)

The codebase is the source of truth. Documentation should be updated whenever
the implementation changes.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ for local development outside Docker
- PostgreSQL access through `DATABASE_URL`

## Environment

Copy `.env.example` to `.env` and adjust values as needed.

Important variables:

- `DATABASE_URL`
- `QUERY_PREVIEW_LIMIT`
- `PGADMIN_DEFAULT_EMAIL`
- `PGADMIN_DEFAULT_PASSWORD`
- `BACKUP_SCHEDULE`
- `RETENTION_DAYS`
- `BACKUP_DIR`
- `BACKUP_SERVICE_URL`

## Docker Development

Run the app with the local PostgreSQL container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile localdb up --build
```

The app is available at:

```text
http://localhost:3000
```

Optional pgAdmin:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile localdb --profile tools up --build
```

pgAdmin is available at:

```text
http://localhost:5050
```

Use the credentials from `.env`.

## Docker Production

Production with a remote PostgreSQL database:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Production with the optional local PostgreSQL container:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile localdb up --build -d
```

The production container runs:

```bash
npx prisma migrate deploy
```

before starting the app.

## Local Development Outside Docker

Start only the local database:

```bash
docker compose -f docker-compose.yml --profile localdb up db -d
```

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npx prisma generate
```

Run the development server:

```bash
npm run dev
```

## Validation

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

If building from a clean local install, run Prisma generation first:

```bash
npx prisma generate
```

## Backup And Restore

The app can list backups, run manual backups, and restore selected backups from
the `/backup` page.

Backup files are stored in:

```text
./backups
```

inside the project on the host, mounted as:

```text
/backups
```

inside containers.

Manual backup through the backup service container:

```bash
docker compose --profile backup exec backup /usr/local/bin/backup.sh
```

Restore through the backup service container:

```bash
docker compose --profile backup exec backup /usr/local/bin/restore.sh /backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

On Windows Git Bash, use double slashes if path conversion causes Docker exec
errors:

```bash
docker compose --profile backup exec backup //usr/local/bin/backup.sh
docker compose --profile backup exec backup //usr/local/bin/restore.sh //backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

## Security Notice

Raw SQL execution and restore operations are intentional features. Keep the app
behind trusted network or access controls. Use a least-privilege PostgreSQL user
when destructive SQL should be restricted.

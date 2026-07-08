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

Variables from `.env.example`:

- `DATABASE_URL`: PostgreSQL connection string used by the app, Prisma
  migrations, backup scripts, and restore scripts. Use host `db` when running
  inside Docker Compose. Use host `localhost` when running `npm run dev`
  directly on your machine.
- `PGADMIN_DEFAULT_EMAIL`: Login email for the optional pgAdmin container.
- `PGADMIN_DEFAULT_PASSWORD`: Login password for the optional pgAdmin container.
- `BACKUP_SCHEDULE`: Cron expression used by the backup service container.
  The example `0 0 * * *` runs once per day at midnight.
- `RETENTION_DAYS`: Number of days to keep generated backup files before the
  backup script removes older files.
- `BACKUP_DIR`: Optional backup directory override. If unset, the app/scripts
  use `/backups` in Docker or a local `backups` directory when available.
- `QUERY_PREVIEW_LIMIT`: Maximum number of rows returned to the Query page for
  on-screen preview.
- `QUERY_STATEMENT_TIMEOUT_MS`: PostgreSQL statement timeout, in milliseconds,
  applied to query preview and export sessions.

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
node ./node_modules/prisma/build/index.js migrate deploy
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

The app backup API runs local backup scripts by default. If `BACKUP_SERVICE_URL`
is configured, the app calls that HTTP backup service instead.

Start the backup service container before using `docker compose exec backup ...`:

```bash
docker compose --profile backup up -d backup
```

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

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
- Git-friendly query and database-schema context bundles for AI agents.
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

## AI Query Context Repository

From the Query page, select a database, choose **Export Schema**, and then
choose **Repository Bundle**. The downloaded ZIP is ready to extract into a Git
repository. It contains:

```text
README.md
AGENTS.md
manifest.json
schema/
  catalog.md
  tables/
queries/
  <database>/
  unassigned/
```

`schema/catalog.md` is the compact table and relationship index. Files under
`schema/tables/` are the canonical structure context and must not be edited
manually. The bundle includes queries for the selected database and, by
default, queries without a database under `queries/unassigned/`.

### Instructions For AI Agents

Before writing SQL, read `manifest.json` and `schema/catalog.md`, then open only
the relevant files under `schema/tables/` and existing queries for the target
database.

- Use only tables and columns present in the relevant `schema/tables/*.sql`
  files.
- Prefer declared foreign keys when joining tables.
- Do not invent relationships. Ask for clarification or document an assumption
  in the query description when no foreign key establishes the relationship.
- Create one query per `.sql` file under `queries/<database>/`.
- Use a lowercase kebab-case filename, such as `customer-order-summary.sql`.
- Keep all `-- xpp:*` metadata comments together at the beginning of the file.
- Do not wrap SQL in Markdown code fences.
- Prefer explicit selected columns over `SELECT *`.
- Generate read-only SQL unless the request explicitly requires DML or DDL.
- Do not execute generated queries. Importing a query through the application
  saves it but does not execute it.

Every new query file must use this structure:

```sql
-- xpp:name: Customer Order Summary
-- xpp:version: 1
-- xpp:databaseName: application_database
-- xpp:description: Summarizes order totals for each customer.

SELECT
    c.id,
    c.name,
    SUM(o.total_amount) AS total_order_amount
FROM public.customers AS c
JOIN public.orders AS o
    ON o.customer_id = c.id
GROUP BY
    c.id,
    c.name;
```

The required metadata fields are `name`, `version`, `databaseName`, and
`description`. Empty database and description values are allowed, but all four
metadata lines must be present. End executable SQL statements with semicolons. The generated
bundle also contains these instructions in its own `README.md` and a concise
`AGENTS.md`, so an AI agent can work directly from the extracted repository.

Import accepts individual `.sql` files or a repository `.zip`. ZIP imports
read only `queries/**/*.sql`; generated schema SQL is ignored. Import conflicts
are matched by database and query name. The replacement mode deletes only
queries in the database scopes represented by the imported files.

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

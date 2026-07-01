# Runtime Architecture

## Application Shape

The app is a Next.js App Router project using JavaScript. It has no separate
Express server.

Main areas:

- Pages: `src/app`
- API routes: `src/app/api`
- Shared server utilities: `src/lib`
- Query UI components: `src/components/query`
- Shadcn-style UI components: `src/components/ui`
- Prisma schema and migrations: `prisma`
- Backup scripts and backup container: `backup`

## Request Flow

Browser pages call internal API routes with `fetch`.

API routes then use:

- Prisma Client for saved-query metadata.
- `pg.Pool` for dynamic PostgreSQL work.
- `ExcelJS` for import/export.
- Shell scripts for backup and restore when no backup service URL is configured.

## Server Runtime

API routes are expected to run in the Node.js runtime. The import and export
paths depend on Node-compatible streams, PostgreSQL clients, and ExcelJS.

## Important Runtime Files

- `src/lib/db.js`: Prisma client, default PostgreSQL pool, per-database pool cache.
- `src/lib/ingest.js`: Excel/date/value parsing helpers.
- `src/lib/backup.js`: Backup listing, path validation, script execution, optional service calls.
- `src/lib/api-client.js`: Browser JSON fetch helper.

## Data Flow Summary

Import:

1. User selects a database and table, then uploads an `.xlsx` file.
2. API reads the workbook stream.
3. API validates headers against the selected table columns.
4. API inserts rows in batches inside a transaction.

Query:

1. User selects a database.
2. User writes SQL in the editor.
3. API executes the SQL through `pg`.
4. Results are returned as JSON for preview or streamed as `.xlsx` for export.

Backup:

1. UI calls `/api/backup` or `/api/restore`.
2. API either calls `BACKUP_SERVICE_URL` or runs local scripts.
3. Scripts use `pg_dump`, `psql`, and files in the backup directory.

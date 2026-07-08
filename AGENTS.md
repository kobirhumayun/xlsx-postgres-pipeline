# AGENTS.md

## Codex Entry Point

This file is the Codex project entry point for this repository.

Codex reads `AGENTS.md` before doing project work. Keep durable repo rules here
and keep detailed architecture references in `architecture/`.

## Repository Purpose

XLSX Postgres Pipeline is a trusted single-user/operator Next.js app for:

- Importing `.xlsx` files into PostgreSQL tables.
- Creating simple PostgreSQL tables from Excel headers.
- Running raw SQL queries.
- Exporting query results to Excel.
- Saving SQL queries.
- Running backup and restore workflows.

## Source Of Truth

The implementation is final for this documentation pass.

When docs and code conflict:

1. Verify the current code.
2. Update the docs to match the code.
3. Do not change runtime code unless the user explicitly asks for code changes.

## Architecture Map

Use `architecture/README.md` as the architecture documentation index.

Read architecture docs in this order when context is needed:

1. `architecture/00_PROJECT_OVERVIEW.md`
2. `architecture/01_RUNTIME_ARCHITECTURE.md`
3. `architecture/02_DATA_AND_DATABASE.md`
4. `architecture/03_API_CONTRACTS.md`
5. `architecture/04_UI_WORKFLOWS.md`
6. `architecture/05_DOCKER_AND_ENVIRONMENTS.md`
7. `architecture/06_SECURITY_AND_OPERATIONS.md`
8. `architecture/07_BACKUP_AND_RESTORE.md`
9. `architecture/08_VALIDATION_AND_TESTING.md`
10. `architecture/09_CODEX_HANDOFF.md`

## Key Implementation Paths

- Pages: `src/app`
- API routes: `src/app/api`
- Shared server utilities: `src/lib`
- Query UI components: `src/components/query`
- UI primitives: `src/components/ui`
- Prisma schema and migrations: `prisma`
- Docker and Compose: `Dockerfile`, `docker-compose*.yml`
- Backup scripts/container: `backup`

## Project Rules For Codex

- Treat raw SQL execution as an intentional product feature.
- Treat the app as a trusted operator tool with no built-in authentication.
- Keep docs current-state and implementation-focused.
- Do not reintroduce stale dataset/report/relationship architecture as implemented.
- Use exact paths, routes, commands, and environment variable names in docs.
- Prefer small documentation edits scoped to the affected behavior.

## Validation Commands

Use these commands when relevant to the change:

```bash
npx prisma generate
npm run build
npm run lint
```

Ad hoc database verification scripts live in `test-scripts/` and may require a
running database, a running app, and a valid `.env`.

## Security Notes

- No authentication is implemented.
- `/api/query/run` can execute DDL and DML.
- Restore operations are destructive.
- Keep deployments behind trusted network or external access controls.
- Use least-privilege PostgreSQL credentials when destructive access should be limited.

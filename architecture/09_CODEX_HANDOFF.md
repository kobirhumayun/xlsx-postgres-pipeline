# Codex Handoff

## Orientation

Start with the repository root `AGENTS.md`. That file is the Codex project
instruction entry point.

Use this file as a secondary handoff guide after Codex has loaded repo
instructions.

Read in this order:

1. `AGENTS.md`
2. `architecture/README.md`
3. `architecture/00_PROJECT_OVERVIEW.md`
4. The specific architecture file for the task area.
5. The matching implementation files.

## Code Is Final For This Pass

For this documentation refactor, do not change runtime code.

Future code changes should update these docs in the same pull request or commit.

## Codex Instruction Structure

Codex guidance is layered:

- Root `AGENTS.md`: durable repository rules and project map.
- `architecture/AGENTS.md`: documentation-specific rules for this folder.
- Architecture markdown files: current-state reference material, not instruction
  entry points.

Keep durable behavior instructions in `AGENTS.md`; keep descriptive system
documentation in `architecture/`.

## Important Implementation Paths

Application:

- `src/app/page.js`
- `src/app/import/page.js`
- `src/app/query/page.js`
- `src/app/backup/page.js`

API:

- `src/app/api/structure/route.js`
- `src/app/api/import/flexible/route.js`
- `src/app/api/query/run/route.js`
- `src/app/api/query/export/route.js`
- `src/app/api/saved-queries/route.js`
- `src/app/api/backup/route.js`
- `src/app/api/restore/route.js`
- `src/app/api/health/route.js`

Libraries:

- `src/lib/db.js`
- `src/lib/ingest.js`
- `src/lib/backup.js`
- `src/lib/api-client.js`

Deployment:

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `entrypoint.sh`
- `backup`

Database:

- `prisma/schema.prisma`
- `prisma/migrations`

## Review Priorities

When reviewing future changes, check:

- Whether docs still match implemented routes and environment variables.
- Whether raw SQL behavior is intentionally preserved.
- Whether Docker startup and Prisma generation still work.
- Whether import header validation still matches UI messaging.
- Whether backup and restore behavior is accurately documented.

## Do Not Reintroduce Stale Concepts

Do not document these as implemented unless code is added for them:

- Dataset builder
- Relationship builder
- Report builder
- Curated row storage
- Raw row storage
- Dataset-specific upsert/hash logic

## Preferred Documentation Style

- Current-state wording.
- Concrete paths and route names.
- Short operational warnings.
- No speculative roadmap items in architecture docs.
- Keep instructions reproducible with exact commands.

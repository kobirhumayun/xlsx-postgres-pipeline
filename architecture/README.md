# Architecture Documentation Index

This folder is the current-state architecture documentation for the XLSX
Postgres Pipeline project.

Codex project instructions start at the repository root:

- [../AGENTS.md](../AGENTS.md)

This file is the architecture index, not the Codex entry point.

The codebase is final for this documentation pass. These documents describe the
implemented system and should be updated when code changes. If documentation and
code conflict, verify the code first and then correct the documentation.

## Read Order

1. [Project Codex Instructions](../AGENTS.md)
2. [00 Project Overview](./00_PROJECT_OVERVIEW.md)
3. [01 Runtime Architecture](./01_RUNTIME_ARCHITECTURE.md)
4. [02 Data And Database](./02_DATA_AND_DATABASE.md)
5. [03 API Contracts](./03_API_CONTRACTS.md)
6. [04 UI Workflows](./04_UI_WORKFLOWS.md)
7. [05 Docker And Environments](./05_DOCKER_AND_ENVIRONMENTS.md)
8. [06 Security And Operations](./06_SECURITY_AND_OPERATIONS.md)
9. [07 Backup And Restore](./07_BACKUP_AND_RESTORE.md)
10. [08 Validation And Testing](./08_VALIDATION_AND_TESTING.md)
11. [09 Codex Handoff](./09_CODEX_HANDOFF.md)

## Documentation Rules

- Keep root `AGENTS.md` as the first project-level Codex instruction document.
- Document what the code currently does.
- Keep implementation references concrete: paths, routes, commands, and env vars.
- Put operator warnings near the workflow they affect.
- Do not keep planned or historical requirements in this folder unless they are
  clearly marked as not implemented.
- Prefer small focused documents over one large architecture file.

## Project Boundaries

- Single-user/operator web app.
- No built-in authentication.
- Raw SQL execution is an intentional feature.
- PostgreSQL credentials are server-side only.
- Flexible import writes directly into selected PostgreSQL tables.
- Prisma is used for app metadata, while raw PostgreSQL access handles dynamic
  imports, schema discovery, queries, export, backup, and restore.

# architecture/AGENTS.md

## Architecture Documentation Instructions

This directory contains current-state architecture documentation.

When editing files in this directory:

- Keep `../AGENTS.md` as the Codex project entry point.
- Keep `architecture/README.md` as the architecture index only.
- Describe implemented code, not planned requirements.
- Link to concrete implementation paths when useful.
- Do not document dataset builders, relationship builders, report builders,
  curated row storage, or raw row storage as implemented.
- Keep operational warnings close to the behavior they affect.

## Required Structure

Current architecture files:

- `README.md`
- `00_PROJECT_OVERVIEW.md`
- `01_RUNTIME_ARCHITECTURE.md`
- `02_DATA_AND_DATABASE.md`
- `03_API_CONTRACTS.md`
- `04_UI_WORKFLOWS.md`
- `05_DOCKER_AND_ENVIRONMENTS.md`
- `06_SECURITY_AND_OPERATIONS.md`
- `07_BACKUP_AND_RESTORE.md`
- `08_VALIDATION_AND_TESTING.md`
- `09_CODEX_HANDOFF.md`

If a new architecture document is added, update both:

- `architecture/README.md`
- `../AGENTS.md`

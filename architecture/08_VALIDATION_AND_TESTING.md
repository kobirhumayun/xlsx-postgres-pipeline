# Validation And Testing

## Available Commands

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

Generate Prisma Client:

```bash
npx prisma generate
```

Full automated test suite:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

Coverage with enforced thresholds:

```bash
npm run test:coverage
```

Focused query context tests:

```bash
npm run test:query-context
```

## Current Validation Notes

`npm install` and `npm ci` generate Prisma Client through the `postinstall`
script. `npm run build` also generates it through `prebuild`, so a separate
manual generation step is not required before building. Use
`npx prisma generate` when an explicit generation check is useful.

The Dockerfile also runs Prisma generation in the `deps` stage.

## Automated Test Suite

Tests run with Vitest in a Node environment and live under `tests/`. The suite
uses mocks and in-memory fixtures, so its default run does not require a live
PostgreSQL database or Next.js server.

Coverage reports are written to `coverage/`. The configured gates cover the
core deterministic libraries and require at least:

- 80% statements.
- 80% lines.
- 80% functions.
- 75% branches.

The suite covers:

- Saved-query file parsing, naming, serialization, and every import mode.
- ZIP creation, streaming, filtering, corruption handling, and size limits.
- XLSX ingest value normalization, business keys, row hashes, and mapping errors.
- PostgreSQL catalog collection plus Markdown, DDL, and repository bundle output.
- Backup filename/path safeguards, listing, execution modes, and service errors.
- JSON API client response and error handling.
- Query execution, saved-query, restore-safety, and health route contracts with
  mocked infrastructure.

`npm run test:query-context` runs only `tests/query-context.test.js`.

## Ad Hoc Verification Scripts

Other ad hoc verification scripts live in `test-scripts`.

The other scripts are not wired into `package.json` scripts and may require:

- A running PostgreSQL database.
- A running Next.js app.
- A valid `.env`.

Scripts:

- `test-scripts/test_structure.mjs`
- `test-scripts/verify_ddl.mjs`
- `test-scripts/verify_features.mjs`
- `test-scripts/verify_standalone.mjs`

## Recommended Review Checks

Before shipping documentation or deployment changes:

1. Run `npx prisma generate`.
2. Run `npm run build`.
3. Run `npm run lint`.
4. Run `npm test` for all code changes.
5. Run `npm run test:coverage` when changing core libraries or test coverage.
6. If database behavior changed, run the relevant script in `test-scripts`.

## Known Documentation Scope

This validation document describes available checks. Validation status can
change as the implementation evolves, so treat command output as authoritative.

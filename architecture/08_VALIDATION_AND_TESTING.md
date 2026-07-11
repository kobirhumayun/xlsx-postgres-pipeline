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

Query context feature tests:

```bash
npm run test:query-context
```

## Current Validation Notes

Prisma Client must exist before local production builds. In a clean local
checkout, run:

```bash
npx prisma generate
```

before:

```bash
npm run build
```

The Dockerfile runs Prisma generation in the `deps` stage.

## Test Scripts

Focused query context tests run through Node's built-in test runner:

- `test-scripts/query-context.test.mjs`

They cover versioned query files, database-aware import identity, repository ZIP
filtering, compact bundle contents, schema fingerprints, and context DDL.

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
4. Run `npm run test:query-context` when query context features change.
5. If database behavior changed, run the relevant script in `test-scripts`.

## Known Documentation Scope

This validation document describes available checks. It does not claim that the
current lint state is clean. Treat command output as authoritative.

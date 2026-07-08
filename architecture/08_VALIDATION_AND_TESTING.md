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

Ad hoc verification scripts live in `test-scripts`.

They are not wired into `package.json` scripts and may require:

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
4. If database behavior changed, run the relevant script in `test-scripts`.

## Known Documentation Scope

This validation document describes available checks. It does not claim that the
current lint state is clean. Treat command output as authoritative.

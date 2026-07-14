# Data And Database

## PostgreSQL Access

The app uses PostgreSQL in two ways:

- Prisma Client for the `SavedQuery` metadata model.
- Raw `pg` connections for flexible import, schema discovery, SQL execution,
  export, backup, and restore.

This split is intentional because flexible import and query execution target
arbitrary tables and databases that are not represented in the Prisma schema.

## Prisma Schema

The implemented Prisma model is:

- `SavedQuery`

Fields:

- `id`
- `name`
- `description`
- `query`
- `databaseName`
- `createdAt`
- `updatedAt`

The migration for this model lives in `prisma/migrations`.

## Saved Query Files

Saved queries can be exported for Git storage as plain `.sql` files. The file
format stores metadata in leading SQL comments:

- `-- xpp:name:`
- `-- xpp:version:`
- `-- xpp:databaseName:`
- `-- xpp:description:`

The remaining file body is stored as the saved query SQL. Importing these files
creates, updates, copies, or replaces `SavedQuery` records depending on the
selected import mode and does not execute the SQL. Exported zip files include
`queries/README.md` with the file-format summary.

Repository-bundle query files therefore have two regions: the four-line `xpp`
metadata block and the stored SQL body that follows it. Ordinary SQL comments
after the metadata belong to the body. A Run action executes that entire body in
one request. Numeric filename prefixes communicate intended order to people and
agents; the application does not schedule or execute repository files
automatically.

`name` and version `1` metadata are required for import. Current exports always
write all four metadata lines; `databaseName` and `description` values can be
empty. Import identity is the case-insensitive combination of database name and
query name. Repository ZIP imports read only `.sql` files under `queries/` and
ignore schema SQL.

## Dynamic Database Connections

`src/lib/db.js` creates a default pool from `DATABASE_URL`.

When a request includes `databaseName`, the app rewrites the database name in
the base `DATABASE_URL` and creates a cached pool for that database.

Operational implication:

- The selected database must be reachable with the same credentials.
- The database user must have the permissions required by the requested action.
- Database names are discovered from PostgreSQL and passed through the UI, but
  direct API callers can still submit a database name.

## Schema Metadata Export

`POST /api/schema/export` reads PostgreSQL catalog metadata from the selected
database and packages it for Git and AI-agent context.

The export can include:

- Tables and columns.
- Primary keys, foreign keys, unique constraints, and checks.
- Index definitions.
- Optional views and materialized views.
- Optional estimated row counts from PostgreSQL catalog statistics.

The export does not include table data or sample rows.

Repository bundles use a compact `schema/catalog.md` plus one context DDL file
per relation under `schema/tables/`. The standalone schema export retains JSON
and Markdown representations for compatibility with external machine tooling.

The generated repository instructions define query files as independently
executable data-purification or reporting steps. Temporary tables are scoped to
one SQL file and one Run request because query requests do not share database
connections. Persistent intermediate and report tables must be schema-qualified
and use a prompt-defined refresh strategy.

## Flexible Import Tables

Flexible import writes into user-selected PostgreSQL tables.

Rules:

- Excel row 1 is treated as the header row.
- Headers must match target table column names exactly.
- Missing columns are allowed only when the database column is nullable or has a default.
- Extra headers are rejected.
- Rows are inserted with parameterized values.
- Table and column identifiers are quoted before SQL construction.

## Table Creation

The import page can create a simple table before importing.

Rules:

- Tables are created in the `public` schema.
- Table names must match the API validator.
- An `id SERIAL PRIMARY KEY` column is always added.
- User-selected columns use one of the allowed PostgreSQL types.
- Optional indexes can be created for selected columns.

## Not Implemented

The final code does not include:

- `datasets`
- `relationships`
- `reports`
- `curated_rows`
- `raw_rows`
- `dataset_id`
- `business_key`
- row hashing or upsert logic

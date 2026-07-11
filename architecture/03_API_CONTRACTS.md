# API Contracts

All API routes are internal application routes under `src/app/api`.

## Health

`GET /api/health`

Returns:

```json
{
  "status": "ok",
  "timestamp": "ISO timestamp"
}
```

## Structure

`GET /api/structure`

Lists non-template databases.

`GET /api/structure?database=<name>`

Lists base tables in the selected database.

`GET /api/structure?database=<name>&table=<schema.table>`

Lists columns for the selected table.

`POST /api/structure`

Creates a table in `public`.

Body:

```json
{
  "databaseName": "optional database name",
  "tableName": "table_name",
  "columns": [
    {
      "name": "column_name",
      "type": "TEXT",
      "isIndexed": false
    }
  ]
}
```

Allowed column types:

- `TEXT`
- `NUMERIC`
- `INTEGER`
- `BOOLEAN`
- `DATE`
- `TIMESTAMP`
- `JSONB`

## Schema Export

`POST /api/schema/export`

Exports PostgreSQL schema metadata as a `.zip` for Git storage and AI-agent
context. The export is metadata-only and does not include sample rows or table
data.

Body:

```json
{
  "databaseName": "optional database name",
  "schemas": ["optional schema names"],
  "includeRowCounts": true,
  "includeIndexes": true,
  "includeConstraints": true,
  "includeViews": false
}
```

When `schemas` is omitted or empty, all non-system schemas are included.

The zip contains:

- `schema/README.md`
- `schema/database.schema.json`
- `schema/database.schema.md`
- `schema/tables/*.md`
- `schema/tables/*.sql`

The JSON file is the canonical machine-readable schema context. Markdown and
SQL files are generated for human and AI-agent readability.

## Repository Bundle Export

`POST /api/repository/export`

Exports a Git-ready ZIP containing the selected database schema, every saved
query grouped by its `databaseName`, a machine-readable manifest, and query
authoring instructions for AI agents. No table rows are included.

Body:

```json
{
  "databaseName": "required database name",
  "schemas": ["optional schema names"],
  "includeRowCounts": true,
  "includeIndexes": true,
  "includeConstraints": true,
  "includeViews": false
}
```

The ZIP contains:

- `README.md`
- `AGENTS.md`
- `manifest.json`
- `schema/database.schema.json`
- `schema/database.schema.md`
- `schema/tables/*`
- `queries/<database>/*.sql`
- `queries/unassigned/*.sql` when saved queries have no database name

The schema files omit volatile generation timestamps for cleaner Git diffs.
The timestamp and warnings about unassigned or cross-database queries are
recorded in `manifest.json`.

## Flexible Import

`POST /api/import/flexible`

Multipart form fields:

- `file`: required `.xlsx` file.
- `tableName`: required table name, optionally schema-qualified.
- `databaseName`: optional database name.
- `sheetName`: optional worksheet name.

Success response:

```json
{
  "summary": {
    "totalRows": 0,
    "okRows": 0,
    "errorRows": 0
  },
  "errors": []
}
```

## Query Run

`POST /api/query/run`

Body:

```json
{
  "query": "SELECT * FROM table_name",
  "databaseName": "optional database name"
}
```

Behavior:

- Queries beginning with `SELECT` or `WITH` use a cursor and return a preview.
- Other SQL is executed directly.
- DDL and DML are supported by the implementation.

## Query Export

`POST /api/query/export`

Body:

```json
{
  "query": "SELECT * FROM table_name",
  "databaseName": "optional database name"
}
```

Returns an `.xlsx` stream.

## Saved Queries

`GET /api/saved-queries`

Lists saved queries ordered by `updatedAt` descending.

`POST /api/saved-queries`

Creates a saved query.

`PUT /api/saved-queries`

Updates a saved query.

`DELETE /api/saved-queries?id=<id>`

Deletes a saved query.

`POST /api/saved-queries/files/export`

Exports saved queries as a `.zip` file containing plain `.sql` files under
`queries/`.

Body:

```json
{
  "ids": ["optional saved query ids"]
}
```

When `ids` is omitted or empty, all saved queries are exported. Each `.sql`
file stores saved-query metadata in leading `-- xpp:*` comments followed by the
SQL body. The zip also includes `queries/README.md` with the file-format notes.

`POST /api/saved-queries/files/preview`

Previews an import without writing to the database.

Multipart form fields:

- `files`: one or more `.sql` files.
- `mode`: optional import mode.

Supported import modes:

- `upsert`: create new queries and update matching names.
- `create`: create new queries and skip matching names.
- `copy`: create imported queries as copies, adding numeric suffixes when needed.
- `replace`: delete existing saved queries and create the valid imported queries.

The response includes counts for created, updated, skipped, and errored files,
plus per-file actions.

`POST /api/saved-queries/files/import`

Imports one or more plain `.sql` files into saved queries.

Multipart form fields:

- `files`: one or more `.sql` files.
- `mode`: optional import mode. Defaults to `upsert`.

The import parser reads leading `-- xpp:*` metadata comments and saves the
remaining SQL body. Imported SQL is not executed. `replace` imports are rejected
when any selected file has a parse error.

## Backup

`GET /api/backup`

Lists known backup files.

Response includes `mode`, either `service` or `local-script`.

`POST /api/backup`

Runs a backup.

## Restore

`POST /api/restore`

Body:

```json
{
  "filename": "backup_YYYYMMDD_HHMMSS.sql.gz",
  "confirmationToken": "RESTORE"
}
```

The confirmation token can be `RESTORE` or the exact backup filename.

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

## Backup

`GET /api/backup`

Lists known backup files.

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

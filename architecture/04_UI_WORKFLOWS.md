# UI Workflows

## Home

Path: `/`

Purpose:

- Entry point linking to import, query, and backup workflows.

## Import

Path: `/import`

Purpose:

- Upload Excel files.
- Select a target database and table.
- Compare Excel headers with table columns.
- Create a simple new table from Excel headers.
- Import rows and show summary/error output.

Primary API routes:

- `GET /api/structure`
- `POST /api/structure`
- `POST /api/import/flexible`

Important UI behavior:

- The browser reads workbook headers for preview.
- Creation mode normalizes detected headers into candidate SQL column names.
- Existing-table mode warns about missing and extra columns before import.

## Query

Path: `/query`

Purpose:

- Browse databases and tables.
- Write SQL in a Monaco editor.
- Run queries and preview results.
- Export query results.
- Save, edit, load, and delete saved queries.
- Export saved queries as `.sql` files in a `.zip`.
- Import multiple saved queries from `.sql` files.
- Keep recent query history in browser local storage.

Primary API routes:

- `GET /api/structure`
- `POST /api/query/run`
- `POST /api/query/export`
- `/api/saved-queries`
- `POST /api/saved-queries/files/export`
- `POST /api/saved-queries/files/import`

Important UI behavior:

- A database must be selected before the Run button is enabled.
- Export only requires query text in the current UI, but the API still receives
  the selected database when present.
- Query history is local to the browser.
- Saved-query file import updates records by query name and does not execute
  imported SQL.

## Backup

Path: `/backup`

Purpose:

- List backup files.
- Trigger manual backup.
- Restore a selected backup after confirmation.

Primary API routes:

- `GET /api/backup`
- `POST /api/backup`
- `POST /api/restore`

Important UI behavior:

- Restore is disabled until the user types `RESTORE` or the selected filename.
- The UI displays backup directory, file size, and backup status when available.

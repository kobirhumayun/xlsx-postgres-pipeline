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
- Export selected database schema metadata for AI-agent context.
- Export a Git-ready repository bundle containing compact schema context,
  selected-database queries, a manifest, and AI-agent instructions.
- Write SQL in a Monaco editor.
- Run queries and preview results.
- Export query results.
- Save, edit, load, and delete saved queries.
- Export all, selected, or individual saved queries as `.sql` files in a `.zip`.
- Import multiple saved queries from `.sql` files or a repository ZIP by picker
  or drag and drop.
- Keep recent query history in browser local storage.

Primary API routes:

- `GET /api/structure`
- `POST /api/schema/export`
- `POST /api/repository/export`
- `POST /api/query/run`
- `POST /api/query/export`
- `/api/saved-queries`
- `POST /api/saved-queries/files/export`
- `POST /api/saved-queries/files/preview`
- `POST /api/saved-queries/files/import`

Important UI behavior:

- A database must be selected before the Run button is enabled.
- Schema export is available from the Schema tab after selecting a database.
- Schema export can include estimated row counts, indexes, constraints, and
  views. It does not include table data.
- Repository bundle export uses the same schema options and includes queries
  assigned to the selected database. Unassigned queries can optionally be
  included in an `unassigned` folder.
- Export only requires query text in the current UI, but the API still receives
  the selected database when present.
- Query history is local to the browser.
- Saved-query file import previews per-file actions before applying changes.
- Saved-query file import matches database plus query name and supports updates,
  create-only imports, copies, and database-scoped replacement.
- Repository ZIP imports read only `queries/**/*.sql` and ignore schema SQL.
- Imported SQL is saved only and is not executed.

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

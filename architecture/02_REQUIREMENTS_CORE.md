# Core Capabilities

## A) Flexible Import (Core)
Allow imports into arbitrary PostgreSQL tables.
- UI allows selecting Database and Table from schema browser.
- Server validates headers against table columns.
- Performs INSERTs directly using `INSERT INTO table ...` syntax.
- Supports Excel files with header rows.
- Normalizes cell values based on column data types (number, date/time, boolean, text) and reports per-row, per-column parse errors.

## B) Custom Query (Core)
UI to execute raw SQL queries.
- Read-only intent (though technically permissions depend on DB user).
- Schema browser sidebar to find tables.
- "Run Query" displays results grid.
- "Export to Excel" streams results.

## C) Export
UI button “Export to Excel” for query results.
- Server executes query and streams an `.xlsx` file.
- Uses ExcelJS streaming writer for performance.

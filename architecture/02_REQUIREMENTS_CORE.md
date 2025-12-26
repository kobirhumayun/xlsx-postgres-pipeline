# Core Capabilities

## A) Dataset Registry
UI screen to define datasets (each dataset corresponds to an Excel source).
Dataset config stored in Postgres and includes:
- datasetId (slug), display name
- expected sheet name (or allow selection on upload)
- primary key fields (one or more columns)
- column mapping and type expectations (date/number/text/boolean)
- join keys used for relationships (configurable)

## B) Import / ingestion
UI to upload Excel + select datasetId + sheet name.
Server reads Excel with exceljs, converts rows to JSON, writes to Postgres.

Two-layer storage model:
1) Raw rows table (JSONB) preserving original values & types
2) Curated typed table(s) for each dataset (relational, consistent types)

Each upload creates an Import Run record:
- file name, file hash, time, datasetId, row count, parse error count

Deterministic upsert strategy:
- Compute business key from dataset primary key fields
- Compute row_hash from canonicalized raw row
- If business key exists AND hash changed → update curated + raw reference
- If new → insert
- Store `last_import_run_id` on curated records

UI must show import summary + errors.

## C) Parsing & normalization
Robust parsers for common Excel issues:
- dates: Excel numeric dates, ISO strings, locale strings
- numbers: commas, currency symbols, blanks
- null/empty cells

Per field store:
- raw_value in raw JSONB
- parsed_value in curated typed columns
- parse_status / parse_error per row in raw_rows.parse_errors_jsonb

Bad data must NOT be dropped silently; it must be surfaced.

## D) Relationships & reporting
Relationships configuration UI:
- relationshipId
- left_datasetId / right_datasetId
- join mapping (left_field -> right_field)
- cardinality expectation (1:1, 1:many optional)

Predefined report types:
1) Missing related data (anti-join): left rows with no match in right
2) Orphaned rows in right (optional)
3) Duplicate key detection within a dataset
4) Key mismatch / type mismatch statistics

Reports must be parameterizable (filter by import run, date range, status).
Prefer SQL queries/views with server endpoints.

## E) Export
UI button “Export Report to Excel”.
Server executes report query and streams an `.xlsx` file.
Must use ExcelJS streaming writer.
# API Routes (Suggested)

## Datasets
- POST /api/datasets  (create/update dataset)
- GET  /api/datasets

## Import
- POST /api/import (multipart upload)
  - creates import_run
  - writes raw_rows
  - upserts curated_rows
- GET /api/import/:id (summary)

## Relationships
- POST /api/relationships
- GET  /api/relationships

## Reports
- POST /api/reports/run
  - body: { reportType, params }
  - returns JSON rows + summary stats
- POST /api/reports/export
  - body: { reportType, params }
  - streams .xlsx

## Health
- GET /api/health

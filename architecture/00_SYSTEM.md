# System Overview

## Goal
Build a single-developer local web app that:
- Ingests multiple Excel files
- Normalizes/parses data robustly
- Stores raw + curated relational data in PostgreSQL
- Runs cross-dataset relational “missing related data” + other reports
- Exports report results back to Excel

## User
Single developer is the only user.

## Runtime environments
- Dev: app runs locally, connects to Postgres container via Docker Compose using hostname `db`.
- Prod: app runs in Docker, connects to remote Postgres on a VPS via `DATABASE_URL`.
- Optional: allow a local Postgres container in prod using a compose profile.

## Non-goals
- Multi-user support
- Complex auth (optional basic auth toggle only)
- External cloud services

## High-level workflow
1) Define datasets (schema expectations + mappings + keys)
2) Upload Excel for a dataset and import
3) Inspect import summary + parsing errors
4) Define dataset relationships
5) Run reports (esp. missing related data)
6) Export report results to Excel

## Glossary
- Dataset: configuration describing an Excel source format.
- Import Run: one ingestion execution for one uploaded file.
- Raw rows: JSONB record preserving original Excel values + parse results/errors.
- Curated rows: normalized/typed representation used for reporting & joins.
- Business key: deterministic key computed from dataset primary key fields.
- Row hash: hash computed from canonicalized raw row for change detection.
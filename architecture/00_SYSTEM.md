# System Overview

## Goal
Build a single-developer local web app that:
- Ingests Excel files into arbitrary PostgreSQL tables (Flexible Import).
- Executes custom SQL queries against databases.
- Exports query results to Excel.

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
1) Select Database & Table from schema browser.
2) Upload Excel file to import data.
3) Use Query tool to inspect data (SELECT *).
4) Export results to Excel if needed.

## Glossary
- Flexible Import: Ingesting Excel rows directly into a table where headers match column names.
- Schema Browser: Tool to list databases and tables.
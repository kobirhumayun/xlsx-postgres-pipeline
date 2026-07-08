# Project Overview

## Purpose

XLSX Postgres Pipeline is a Next.js application for importing Excel data into
PostgreSQL tables, running SQL queries, exporting query results to Excel, and
managing local database backups.

The app is designed for a trusted single developer or operator. It is not a
multi-user SaaS app and does not include authentication or authorization.

## Implemented Capabilities

- Import `.xlsx` files into existing PostgreSQL tables.
- Create simple PostgreSQL tables from detected Excel headers.
- Browse available databases, schemas, tables, and table columns.
- Run raw SQL queries against selected databases.
- Export query results to `.xlsx`.
- Save, edit, list, and delete saved SQL queries.
- Trigger backup and restore operations through API routes and shell scripts.
- Run as a local development app or a production standalone Next.js container.

## Non-Goals

- Multi-user access control.
- Dataset mapping or curated-row storage.
- Relationship/report builders.
- Managed cloud backup storage.
- Public internet exposure without an external access-control layer.

## Source Of Truth

The implementation is the source of truth. Architecture docs should describe
the current code in:

- `src/app`
- `src/lib`
- `src/components`
- `prisma`
- `Dockerfile`
- `docker-compose*.yml`
- `backup`

When a behavior changes in code, update the matching document in this folder.

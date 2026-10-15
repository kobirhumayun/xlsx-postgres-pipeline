# Backup And Restore

## Backup Storage

Backups are expected to use filenames like:

```text
backup_YYYYMMDD_HHMMSS.sql.gz
```

Default backup directories:

- `/backups`
- `<project-root>/backups`

The Compose files mount host `./backups` into container `/backups`.

## Backup Script

Script:

```text
backup/backup.sh
```

Behavior:

- Uses `DATABASE_URL`.
- Strips query parameters before passing the URL to `pg_dump`.
- Writes a compressed SQL dump.
- Removes old backup files based on `RETENTION_DAYS`.

## Restore Script

Script:

```text
backup/restore.sh
```

Behavior:

- Requires a backup file path.
- Uses `DATABASE_URL`.
- Strips query parameters before passing the URL to `psql`.
- Pipes decompressed SQL into `psql`.
- Uses `psql -X -v ON_ERROR_STOP=1`; SQL errors stop the restore and prevent
  the subsequent statistics refresh. Earlier statements may already have
  committed because the restore is not wrapped in one transaction.
- After a successful restore, runs database-wide `ANALYZE` with a 60-second
  statement timeout and a five-second lock timeout. This populates statistics
  even for small tables below the automatic-analysis threshold.
- If this maintenance step fails, the script exits successfully for the
  completed data restore and writes a warning to stderr (returned as
  `errorOutput` by the local-script API). Run `ANALYZE` separately instead of
  repeating the restore. PostgreSQL warnings about skipped tables are also
  available on stderr. External backup services control their own maintenance.

## App API Backup Mode

The app API uses two modes:

1. If `BACKUP_SERVICE_URL` is set, call that service.
2. Otherwise, run local backup or restore scripts from the app container/process.

The current Compose files do not set `BACKUP_SERVICE_URL` by default.

`GET /api/backup` includes a `mode` field with either `service` or
`local-script`.

## Backup Container

The `backup` service is built from `backup/Dockerfile`.

It runs cron in the foreground and schedules:

```bash
/usr/local/bin/backup.sh
```

The schedule is controlled by:

```bash
BACKUP_SCHEDULE="0 0 * * *"
```

## Restore Safety

The app restore API requires a confirmation token:

- `RESTORE`
- or the exact backup filename

This is a UI/API confirmation step only. It is not authentication.

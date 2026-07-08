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

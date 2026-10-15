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

- Uses `BACKUP_DATABASE_URL`, falling back to `DATABASE_URL`.
- `backup/common.sh` removes only Prisma's `schema` URI parameter. It preserves
  libpq options including `sslmode` and `sslrootcert`, and maps node-postgres's
  `sslmode=no-verify` spelling to libpq's `sslmode=require` (encrypted without
  requiring certificate validation). For verified TLS, use `verify-full` and
  mount the provider's CA certificate at the `sslrootcert` path.
- Passes the normalized URI explicitly as `--dbname` to enable libpq URI
  parsing; scripts do not print connection strings.
- Detects the source major using `SHOW server_version_num` and automatically
  selects that major's `pg_dump`. Supported source/target majors are 16, 17,
  and 18. Both Docker images bundle all three on Alpine 3.23. Build arguments
  `POSTGRES_CLIENT_MAJORS` (default `16 17 18`) and `ALPINE_VERSION` configure
  installation; Compose maps `POSTGRES_ALPINE_VERSION` to `ALPINE_VERSION`.
  The former singular `POSTGRES_CLIENT_MAJOR` setting is no longer used.
- `backup/common.sh` probes with the newest available supported `psql`, then
  resolves exact binaries under `/usr/libexec/postgresql<major>` (Alpine) or
  `/usr/lib/postgresql/<major>/bin` (Debian). `PG_CLIENT_ROOT` optionally supplies
  `<root>/<major>/bin` instead. A matching executable on PATH is a fallback for
  native installations. Missing/mismatched binaries and unsupported majors
  fail before the dump. No tools are downloaded at runtime.
- Writes a compressed plain SQL dump with `--clean --if-exists --no-owner
  --no-acl`. Ownership and grants are omitted for portability across local and
  managed-service roles. A temporary file is renamed only after the dump succeeds.
- Removes old backup files based on `RETENTION_DAYS`.

## Restore Script

Script:

```text
backup/restore.sh
```

Behavior:

- Requires a backup file path.
- Uses `RESTORE_DATABASE_URL`, falling back to `DATABASE_URL`, with the same
  URI normalization and explicit `--dbname` handling as backups. Explicit override
  URLs in Docker must use a reachable hostname (such as `db`, not localhost).
- Fully decompresses into a private temporary file before database writes;
  requires plain SQL `pg_dump` version headers. The file is deleted on exit.
- Detects the target major and automatically selects that major's `psql` for
  restore and subsequent `ANALYZE`. Version selection preserves the configured
  URI/TLS options and never switches the destination database.
- Rejects archives whose source or dump-client major exceeds the target server
  major, or whose dump-client major is older than the recorded source. Old
  version-18-client archives are therefore rejected on PostgreSQL 16 before
  applying SQL. If only the dump client was too new, generate a fresh backup
  using the source's matching client. If the source itself is newer than the
  destination, upgrade the destination server; recreating the backup with a
  matching client does not enable downgrades. Upgrading client tools does not
  rewrite existing archives or upgrade the database server.
- Supports the version combinations below, subject to extensions, schema
  features, and destination privileges. Downgrades are blocked before SQL
  writes. Source/dump/target majors outside 16–18 are also blocked; additional
  releases require intentional packaging and validation.

  | Source server | Selected `pg_dump` | Destination servers | Selected `psql` |
  | --- | --- | --- | --- |
  | 16.x | 16.x | 16.x, 17.x, 18.x | Destination major |
  | 17.x | 17.x | 17.x, 18.x | Destination major |
  | 18.x | 18.x | 18.x | 18.x |

- `RESTORE_MODE=empty` (default) checks for user relations, routines, schemas,
  and types before applying SQL. Use an empty staging database for migration.
  Extension dependencies are excluded where directly marked in the catalogs;
  managed-service extensions and permissions still require validation.
- `RESTORE_MODE=replace` explicitly allows the dump's DROP statements to replace
  matching destination objects and data. Objects absent from the dump are not
  removed. No mode merges or reconciles existing rows. New portable backups
  omit source ownership/grants; legacy archives may still contain them.
- Uses `psql -X -q -v ON_ERROR_STOP=1 --single-transaction -c <guard> -f <file>`.
  The guard and dump share a transaction; SQL failures roll back the restore
  and prevent subsequent statistics refresh. This supports the generated
  database-level dumps, not arbitrary scripts containing transaction control,
  database creation, or connection changes.
- After a successful restore, uses a catalog query and `psql` `\gexec` to run
  safely quoted `ANALYZE` statements for user tables, partitioned tables, and
  materialized views. System schemas (`pg_*`, `information_schema`) and direct
  extension members are excluded, avoiding protected-catalog permission
  warnings on managed servers. Each statement has a 60-second statement timeout
  and a five-second lock timeout. This populates statistics even for small
  tables below the automatic-analysis threshold.
- If this maintenance step fails, the script exits successfully for the
  completed data restore and writes a warning to stderr (returned as
  `errorOutput` by the local-script API). Run `ANALYZE` for affected user tables
  instead of repeating the restore. PostgreSQL warnings about skipped tables are also
  available on stderr. External backup services control their own maintenance.

## App API Backup Mode

The app API uses two modes:

1. If `BACKUP_SERVICE_URL` is set, call that service.
2. Otherwise, run local backup or restore scripts from the app container/process.

The current Compose files do not set `BACKUP_SERVICE_URL` by default.

The local-script UI shows the destination host, port, and database (without
credentials). It defaults to empty mode; changing modes clears confirmation.
The API forwards `mode` to an external backup service when configured; that
service must implement equivalent preflight, atomicity, and mode semantics.

For a local-to-cloud migration, set `BACKUP_DATABASE_URL` to the local source
and `RESTORE_DATABASE_URL` to a new empty cloud database. Keep `DATABASE_URL`
pointing to the app's current database until the restored data is verified.
Mount CA files into the app container when using `sslrootcert`. Before final
cutover, pause source writes, take a fresh dump, restore to an empty destination,
validate row counts and important queries, and then switch the app connection.
Source version compatibility does not guarantee extension/permission parity.

For remote-to-local restoration, reverse the source/destination overrides:
`BACKUP_DATABASE_URL` selects the remote source and `RESTORE_DATABASE_URL`
selects the local destination using host `db` inside Docker. Local PostgreSQL
18 accepts supported 16/17/18 archives; local 16 cannot accept a source-17/18
archive. For transfers in both directions, use matching server majors. An
occupied local database still requires an explicit replacement or a separate
empty destination. The app's selected query database does not change the
restore destination.

Local-script API executions have a ten-minute process timeout and a 1 MiB
output limit in `src/lib/backup.js`. The statistics timeouts above apply per
statement; they do not extend the API's overall process limit.

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

#!/bin/bash
set -e
set -o pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

BACKUP_FILE="${1:-}"
RESTORE_MODE="${RESTORE_MODE:-empty}"
if [[ "$RESTORE_MODE" != empty && "$RESTORE_MODE" != replace ]]; then
    echo 'Restore mode must be empty or replace.' >&2
    exit 1
fi

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: restore.sh <backup_file_path>"
    echo "Available backups:"
    BACKUP_DIR="${BACKUP_DIR:-/backups}"
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No backups found."
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found."
    exit 1
fi

echo "[$(date)] Starting restore from $BACKUP_FILE..."

# Fully decompress before any database writes, catching truncated archives.
umask 077
SQL_FILE=$(mktemp)
trap 'rm -f "$SQL_FILE"' EXIT
gunzip -c "$BACKUP_FILE" > "$SQL_FILE"
SOURCE_MAJOR=$(sed -nE 's/^-- Dumped from database version ([0-9]+).*/\1/p;50q' "$SQL_FILE")
DUMP_MAJOR=$(sed -nE 's/^-- Dumped by pg_dump version ([0-9]+).*/\1/p;50q' "$SQL_FILE")
if [[ ! "$SOURCE_MAJOR" =~ ^[0-9]+$ || ! "$DUMP_MAJOR" =~ ^[0-9]+$ ]]; then
    echo 'Restore blocked: expected a plain SQL pg_dump archive with version headers.' >&2
    exit 1
fi
configure_connection "${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}"
TARGET_MAJOR=$(server_major)
PSQL_MAJOR=$(client_major psql)
if (( SOURCE_MAJOR > TARGET_MAJOR || DUMP_MAJOR > TARGET_MAJOR || DUMP_MAJOR > PSQL_MAJOR )); then
    echo "Restore blocked: source major $SOURCE_MAJOR, dump client major $DUMP_MAJOR, target major $TARGET_MAJOR, psql major $PSQL_MAJOR are incompatible. Create a new backup with client tools matching the source; do not remove SQL errors from the archive." >&2
    exit 1
fi

GUARD='SELECT 1;'
if [[ "$RESTORE_MODE" == empty ]]; then
    GUARD=$(cat <<'SQL'
DO $$ BEGIN
IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
) OR EXISTS (
    SELECT 1 FROM pg_namespace n
    WHERE n.nspname NOT IN ('public', 'information_schema') AND n.nspname !~ '^pg_'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_namespace'::regclass AND d.objid = n.oid AND d.deptype = 'e')
) OR EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e')
) THEN
    RAISE EXCEPTION 'Restore blocked: target contains user objects. Use an empty database, or explicitly select replace mode to replace matching objects. Restore does not merge data.';
END IF;
END $$;
SQL
)
fi
# Guard and dump share a transaction. SQL errors roll back preceding DROP,
# CREATE, and COPY statements instead of leaving a partially restored database.
pg_psql -X -q -v ON_ERROR_STOP=1 --single-transaction -c "$GUARD" -f "$SQL_FILE"

# The data is already restored. Refresh planner statistics, including small
# tables that may never cross the automatic-analysis threshold. Bound the
# maintenance step and report its failure separately from the restored data.
echo "[$(date)] Refreshing database statistics..."
if PGOPTIONS="${PGOPTIONS:+$PGOPTIONS }-c statement_timeout=60000 -c lock_timeout=5000" \
    pg_psql -X -q -v ON_ERROR_STOP=1 -c 'ANALYZE;'; then
    echo "[$(date)] Restore completed successfully; statistics refresh finished."
else
    echo "[$(date)] WARNING: Data restore completed, but statistics refresh failed. Run ANALYZE separately; do not repeat the restore just to refresh statistics." >&2
fi

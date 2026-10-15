#!/bin/bash
set -e
set -o pipefail

BACKUP_FILE="$1"

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

# Extract and restore
# Using psql to restore plain SQL dump (works with DATABASE_URL connection string)
# WARNING: This might fail if database is not clean.
# For robustness, we might want to terminate connections or drop/create schema.
# But simply piping to psql is the standard basic approach for data restoration.
CLEAN_DB_URL="${DATABASE_URL%\?*}"
gunzip -c "$BACKUP_FILE" | psql -X -v ON_ERROR_STOP=1 "$CLEAN_DB_URL"

# The data is already restored. Refresh planner statistics, including small
# tables that may never cross the automatic-analysis threshold. Bound the
# maintenance step and report its failure separately from the restored data.
echo "[$(date)] Refreshing database statistics..."
if PGOPTIONS="${PGOPTIONS:+$PGOPTIONS }-c statement_timeout=60000 -c lock_timeout=5000" \
    psql -X -v ON_ERROR_STOP=1 "$CLEAN_DB_URL" -c 'ANALYZE;'; then
    echo "[$(date)] Restore completed successfully; statistics refresh finished."
else
    echo "[$(date)] WARNING: Data restore completed, but statistics refresh failed. Run ANALYZE separately; do not repeat the restore just to refresh statistics." >&2
fi

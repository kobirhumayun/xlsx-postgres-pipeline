#!/bin/bash
set -e
set -o pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
configure_connection "${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
SOURCE_MAJOR=$(server_major)
DUMP_MAJOR=$(client_major pg_dump)
if [[ "$DUMP_MAJOR" != "$SOURCE_MAJOR" ]]; then
    echo "Backup blocked: pg_dump major $DUMP_MAJOR does not match source server major $SOURCE_MAJOR. Install matching PostgreSQL client tools." >&2
    exit 1
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
RETENTION_DAYS=${RETENTION_DAYS:-7}

echo "[$(date)] Starting backup..."

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Portable ownership/grants; replacement DROP statements are applied only after
# the restore mode's target check. Stage the gzip so failed dumps are not listed.
PARTIAL_FILE=$(mktemp "$BACKUP_DIR/.backup-partial.XXXXXX")
trap 'rm -f "$PARTIAL_FILE"' EXIT
if pg_dump --clean --if-exists --no-owner --no-acl --dbname="$PGDATABASE" | gzip > "$PARTIAL_FILE"; then
    mv "$PARTIAL_FILE" "$BACKUP_FILE"
    echo "[$(date)] Backup completed successfully: $BACKUP_FILE"
else
    echo "[$(date)] Backup failed!"
    exit 1
fi

# Cleanup old backups
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
echo "[$(date)] Cleanup complete."

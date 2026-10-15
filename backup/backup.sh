#!/bin/bash
set -e
set -o pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
configure_connection "${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
select_probe_client
SOURCE_MAJOR=$(server_major)
require_supported_major "$SOURCE_MAJOR" source
DUMP_BIN=$(require_client pg_dump "$SOURCE_MAJOR")
echo "Using pg_dump $SOURCE_MAJOR for PostgreSQL source $SOURCE_MAJOR."

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
if "$DUMP_BIN" --clean --if-exists --no-owner --no-acl --dbname="$PGDATABASE" | gzip > "$PARTIAL_FILE"; then
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

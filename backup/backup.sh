#!/bin/bash
set -e
set -o pipefail

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
RETENTION_DAYS=${RETENTION_DAYS:-7}

echo "[$(date)] Starting backup..."

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform backup
# We use DATABASE_URL if provided. We strip query parameters (like ?schema=public) as pg_dump doesn't like them.
CLEAN_DB_URL="${DATABASE_URL%\?*}"

if pg_dump "$CLEAN_DB_URL" | gzip > "$BACKUP_FILE"; then
    echo "[$(date)] Backup completed successfully: $BACKUP_FILE"
else
    echo "[$(date)] Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Cleanup old backups
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
echo "[$(date)] Cleanup complete."

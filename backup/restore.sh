#!/bin/bash
set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: restore.sh <backup_file_path>"
    echo "Available backups:"
    ls -lh /backups/*.sql.gz 2>/dev/null || echo "No backups found."
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found."
    exit 1
fi

echo "[$(date)] Starting restore from $BACKUP_FILE..."

# Extract and restore
# Using psql to restore plain SQL dump
# WARNING: This might fail if database is not clean.
# For robustness, we might want to terminate connections or drop/create schema.
# But simply piping to psql is the standard basic approach for data restoration.
gunzip -c "$BACKUP_FILE" | psql

if [ $? -eq 0 ]; then
    echo "[$(date)] Restore completed successfully."
else
    echo "[$(date)] Restore failed."
    exit 1
fi

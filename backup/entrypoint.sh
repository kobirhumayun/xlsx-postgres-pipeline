#!/bin/bash
set -e

# Default schedule: Daily at midnight
SCHEDULE="${BACKUP_SCHEDULE:-0 0 * * *}"

echo "Setting up backup cron job with schedule: $SCHEDULE"

# Create cron job
echo "$SCHEDULE /usr/local/bin/backup.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root

# Create log file
touch /var/log/cron.log

echo "Starting cron daemon..."
# Start cron in foreground
exec crond -f -d 8

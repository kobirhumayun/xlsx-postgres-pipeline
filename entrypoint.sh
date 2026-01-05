#!/bin/sh
# entrypoint.sh

# Run migrations
echo "Running database migrations..."
if npx prisma migrate deploy; then
    echo "Migrations applied successfully."
else
    echo "Migration failed!"
    exit 1
fi

# Start the application
exec "$@"

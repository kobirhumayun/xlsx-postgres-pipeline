#!/bin/sh
# entrypoint.sh

case "$DATABASE_URL" in
    *"@localhost:"*|*"@127.0.0.1:"*)
        echo "Rewriting localhost DATABASE_URL host to Docker Compose service host 'db'..."
        DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed -e 's/@localhost:/@db:/' -e 's/@127\.0\.0\.1:/@db:/')
        export DATABASE_URL
        ;;
esac

# Run migrations
echo "Running database migrations..."
if node ./node_modules/prisma/build/index.js migrate deploy; then
    echo "Migrations applied successfully."
else
    echo "Migration failed!"
    exit 1
fi

# Start the application
exec "$@"

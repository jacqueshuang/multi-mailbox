#!/bin/sh
set -e

echo "Running database migrations..."
cd /app
npx --prefix /opt/drizzle drizzle-kit migrate

echo "Starting application..."
exec node dist/index.js
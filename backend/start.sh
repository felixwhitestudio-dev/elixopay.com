#!/bin/bash
# Railway Start Script
# This script checks if database is available before running migrations

echo "🚀 Starting Elixopay Backend..."

# Check if database is required
if [ -n "$DATABASE_URL" ] || [ -n "$PGHOST" ]; then
  echo "📦 Database detected, running migrations..."
  node migrations/migrate.js || echo "⚠️  Migration failed, continuing without database..."
else
  echo "⏭️  No database configured, skipping migrations..."
fi

# Start the server
echo "🌟 Starting server..."
node backend/server.js

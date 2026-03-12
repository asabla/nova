#!/bin/sh
set -e
echo "=== NOVA DB Init ==="

cd /app/packages/api

echo "[1/3] Running database migrations..."
# If db was set up via db:push, backfill the migration journal first
if ! bunx drizzle-kit migrate 2>/dev/null; then
  echo "  Migration failed — attempting to backfill journal from db:push state..."
  bun run /app/db-init-backfill-migrations.ts
  echo "  Re-running migrations..."
  bunx drizzle-kit migrate
fi

echo "[2/3] Seeding database..."
bun run src/lib/seed.ts

echo "[3/3] Ensuring MinIO bucket..."
bun run /app/db-init-bucket.ts

echo "=== DB Init complete ==="

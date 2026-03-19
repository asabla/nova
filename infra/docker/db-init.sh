#!/bin/sh
set -e
echo "=== NOVA DB Init ==="

cd /app/packages/api

echo "[1/3] Running database migrations..."
# Always backfill first — it's idempotent and handles db:push state
bun run /app/db-init-backfill-migrations.ts
bunx drizzle-kit migrate

echo "[2/3] Seeding database..."
bun run src/lib/seed.ts

echo "[3/3] Ensuring MinIO bucket..."
bun run /app/db-init-bucket.ts

echo "=== DB Init complete ==="

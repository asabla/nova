#!/bin/bash
# ─── Nova Database Restore ──────────────────────────────────────────
# Restores a PostgreSQL backup created by db-backup.sh.
#
# Usage:
#   ./infra/scripts/db-restore.sh backups/nova_20260402_120000.sql.gz
#
# WARNING: This drops and recreates the database. All current data
# will be lost. Make a backup first if needed.
# ────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_FILE="${1:?Usage: db-restore.sh <backup-file.sql.gz>}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] ERROR: File not found: ${BACKUP_FILE}" >&2
  exit 1
fi

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-nova}"
DB_NAME="${PGDATABASE:-nova}"

echo "[restore] Restoring from: ${BACKUP_FILE}"
echo "[restore] Target: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
echo "WARNING: This will DROP and RECREATE the '${DB_NAME}' database."
read -p "Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "[restore] Aborted."
  exit 0
fi

if command -v docker &>/dev/null && docker compose ps postgres 2>/dev/null | grep -q "healthy"; then
  echo "[restore] Dropping and recreating database..."
  docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" 2>/dev/null || true
  docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
  docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

  echo "[restore] Restoring backup..."
  gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U "$DB_USER" "$DB_NAME"
else
  echo "[restore] Dropping and recreating database..."
  PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
  PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

  echo "[restore] Restoring backup..."
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
fi

echo "[restore] Done. Run 'bun run db:push' if schema migrations are needed."

#!/bin/bash
# ─── Nova Database Backup ───────────────────────────────────────────
# Creates a compressed PostgreSQL backup.
#
# Usage:
#   ./infra/scripts/db-backup.sh                    # Backup to ./backups/
#   ./infra/scripts/db-backup.sh /path/to/dir       # Backup to specific dir
#   BACKUP_RETENTION_DAYS=14 ./infra/scripts/db-backup.sh  # Custom retention
#
# In Docker:
#   docker compose exec postgres pg_dump -U nova nova | gzip > backup.sql.gz
# ────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/nova_${TIMESTAMP}.sql.gz"

# Database connection from env or defaults
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-nova}"
DB_NAME="${PGDATABASE:-nova}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting PostgreSQL backup..."
echo "[backup] Host: ${DB_HOST}:${DB_PORT} Database: ${DB_NAME}"

# Use docker compose if running from project root, otherwise direct pg_dump
if command -v docker &>/dev/null && docker compose ps postgres 2>/dev/null | grep -q "healthy"; then
  echo "[backup] Using docker compose exec..."
  docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
else
  echo "[backup] Using direct pg_dump..."
  PGPASSWORD="${PGPASSWORD:-}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup] Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Clean up old backups
if [ "$RETENTION_DAYS" -gt 0 ]; then
  DELETED=$(find "$BACKUP_DIR" -name "nova_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
  if [ "$DELETED" -gt 0 ]; then
    echo "[backup] Cleaned up ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
  fi
fi

echo "[backup] Done."

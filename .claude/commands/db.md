Database operations for Nova. Run the specified subcommand.

Arguments: $ARGUMENTS
- "status" — Show database size, connection count, table count, and migration status
- "backup" — Run `./infra/scripts/db-backup.sh` and report the backup file path and size
- "restore <file>" — Run `./infra/scripts/db-restore.sh <file>` (requires confirmation)
- "migrate" — Run `bun run db:push` to sync schema
- "seed" — Run `bun run --filter @nova/api db:seed` to seed the database
- "studio" — Run `bun run db:studio` to open Drizzle Studio

For "status":
1. Check PostgreSQL is healthy: `docker compose ps postgres`
2. Query database size: `docker compose exec postgres psql -U nova -c "SELECT pg_size_pretty(pg_database_size('nova'))"`
3. Query connection count: `docker compose exec postgres psql -U nova -c "SELECT count(*) FROM pg_stat_activity WHERE datname='nova'"`
4. Query table count: `docker compose exec postgres psql -U nova -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"`
5. List recent backups: `ls -lh backups/nova_*.sql.gz 2>/dev/null | tail -5`

Present results clearly. For destructive operations (restore, seed), confirm with the user first.

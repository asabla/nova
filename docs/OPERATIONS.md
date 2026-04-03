# NOVA Operations Runbook

## 1. Health Checks

### API Health Endpoints

All endpoints are on the API server (default `:3000`).

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | No | Liveness probe. Returns `{ status: "ok" }` |
| `/health/ready` | GET | No | Readiness probe. Checks DB, Redis, MinIO, Temporal |
| `/health/system` | GET | No | Runtime info: Bun version, memory usage, DB version, uptime |
| `/health/diagnostics` | POST | No | Deep check: DB extensions (pg_trgm), Redis version, MinIO, LLM providers, Temporal, DNS |

### `/health/ready` Response

- **HTTP 200** with `status: "healthy"` -- all services OK
- **HTTP 200** with `status: "degraded"` -- non-critical service down (MinIO, Temporal)
- **HTTP 503** with `status: "down"` -- critical service down (database or Redis)
- Each check includes `latencyMs` for performance monitoring

```bash
# Quick check
curl -s http://localhost:3000/health | jq .

# Full readiness
curl -s http://localhost:3000/health/ready | jq .

# Deep diagnostics
curl -s -X POST http://localhost:3000/health/diagnostics | jq .
```

### Docker Compose Healthchecks

Each infrastructure service has its own healthcheck defined in `docker-compose.yml`:

- **postgres**: `pg_isready -U nova` (5s interval)
- **redis**: `redis-cli ping` (5s interval)
- **minio**: `mc ready local` (10s interval)
- **temporal**: `temporal operator cluster health` (10s interval, 30s start period)
- **qdrant**: TCP probe on port 6333 (10s interval)
- **searxng**: `wget --spider http://localhost:8080/healthz` (10s interval)
- **api**: `wget http://localhost:3000/health` (10s interval, 10s start period)
- **gateway**: `fetch('http://localhost:3001/health')` (10s interval)

```bash
# Check all container health states
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"
```

---

## 2. Common Issues & Fixes

### Service Won't Start

```bash
# Check container logs
docker compose logs api --tail 50
docker compose logs worker-agent --tail 50

# Verify env vars are set
docker compose config | grep DATABASE_URL

# Check .env exists at repo root
cat .env | grep -E '^(DATABASE_URL|REDIS_URL|OPENAI_API_KEY)'

# Test DB connectivity manually
docker compose exec postgres pg_isready -U nova
docker compose exec postgres psql -U nova -d nova -c "SELECT 1"
```

- Workers depend on `db-init` and `temporal-init` completing. If those fail, workers won't start.
- API depends on `db-init`, `temporal-init`, redis, minio, and qdrant being healthy.

### Temporal Workflow Stuck

```bash
# Open Temporal UI
open http://localhost:8233

# List running workflows via CLI
docker compose exec temporal temporal workflow list --namespace default

# Describe a specific workflow
docker compose exec temporal temporal workflow describe --workflow-id <WF_ID> --namespace default

# Cancel a stuck workflow
docker compose exec temporal temporal workflow cancel --workflow-id <WF_ID> --namespace default

# Terminate (force kill) a workflow
docker compose exec temporal temporal workflow terminate --workflow-id <WF_ID> --namespace default --reason "manual intervention"

# Search by custom attributes
docker compose exec temporal temporal workflow list --query "NovaOrgId='<org-id>'" --namespace default
```

### Redis Connection Failures

```bash
# Test connectivity
docker compose exec redis redis-cli ping

# Check memory usage
docker compose exec redis redis-cli info memory | grep used_memory_human

# Check connected clients
docker compose exec redis redis-cli info clients | grep connected_clients

# Flush all data (DESTRUCTIVE -- dev only)
docker compose exec redis redis-cli FLUSHALL

# Check pub/sub channels (stream relay)
docker compose exec redis redis-cli PUBSUB CHANNELS "stream-events:*"
```

- Verify `REDIS_URL` is `redis://redis:6379` (Docker) or `redis://localhost:6379` (local dev)

### MinIO Bucket Errors

```bash
# Check MinIO health
curl -s http://localhost:9000/minio/health/live

# Open MinIO Console
open http://localhost:9001   # login: minioadmin / minioadmin

# List buckets (from inside the container)
docker compose exec minio mc ls local/

# Ensure the nova-files bucket exists
docker compose exec minio mc mb local/nova-files --ignore-existing
```

- The `db-init` service creates the bucket on startup. If it failed, create manually.
- Check `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET` env vars.

### Qdrant Collection Errors

```bash
# Health check
curl -s http://localhost:6333/healthz

# List collections
curl -s http://localhost:6333/collections | jq '.result.collections[].name'

# Get collection info
curl -s http://localhost:6333/collections/<name> | jq .

# Delete and recreate a collection (DESTRUCTIVE)
curl -X DELETE http://localhost:6333/collections/<name>
# Re-trigger ingestion workflows to rebuild
```

### Worker Not Processing

```bash
# Check worker container is running
docker compose ps worker-agent worker-ingestion worker-background

# Check worker logs for task queue registration
docker compose logs worker-agent --tail 30 | grep -i "queue\|registered\|started"

# Verify Temporal connectivity from worker
docker compose exec worker-agent node -e "
  const { Connection } = require('@temporalio/client');
  Connection.connect({ address: 'temporal:7233' }).then(() => console.log('OK')).catch(console.error);
"

# Check task queue has pollers
docker compose exec temporal temporal task-queue describe --task-queue nova-agent --namespace default
docker compose exec temporal temporal task-queue describe --task-queue nova-ingestion --namespace default
docker compose exec temporal temporal task-queue describe --task-queue nova-background --namespace default
```

- Task queues: `nova-agent`, `nova-ingestion`, `nova-background` (from `@nova/shared/constants`)
- Workers run on Node.js (not Bun). Docker uses compiled JS; dev uses `tsx`.
- If no pollers appear on a task queue, the corresponding worker is not connected.

### OOM During Typecheck

```bash
# Default heap size (set in the typecheck script)
NODE_OPTIONS='--max-old-space-size=6144' npx tsc --noEmit

# If OOM persists, increase to 8GB+
NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit

# Generate trace to find the hotspot
NODE_OPTIONS='--max-old-space-size=12288' npx tsc --noEmit --generateTrace /tmp/tsc-trace -p packages/api/tsconfig.json
```

- Root cause is almost always deeply-inferred generic types
- Known offender: `zValidator` from `@hono/zod-validator` -- all route files must import from `packages/api/src/lib/validator.ts`, never the original package
- See CLAUDE.md "Known OOM sources" section for full details

### SSE Streaming Issues

- Stream relay uses Redis pub/sub. Events are dual-published to channels and Redis lists (`stream-events:{channelId}`) for replay on reconnect.
- If streaming stalls:
  ```bash
  # Check Redis pub/sub is working
  docker compose exec redis redis-cli SUBSCRIBE "test-channel"
  # (in another terminal)
  docker compose exec redis redis-cli PUBLISH "test-channel" "hello"

  # Check for backed-up stream events
  docker compose exec redis redis-cli LLEN "stream-events:<channelId>"
  ```
- Verify the API container is not hitting memory limits (1GB cap in docker-compose)
- Check for proxy/load balancer timeouts that may kill long-lived SSE connections

---

## 3. Log Analysis

### Log Format

API uses **pino** (structured JSON). In dev, logs go to stdout. In production, JSON to stdout.

```jsonc
{"level":"info","time":"2025-01-15T10:30:00.000Z","requestId":"abc-123","msg":"request completed","method":"POST","path":"/api/conversations","status":200,"latency":42}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `level` | `debug`, `info`, `warn`, `error`, `fatal` |
| `requestId` | Unique per-request ID (set by middleware) |
| `err` | Error object with `message`, `stack` |
| `method`, `path` | HTTP method and route |
| `status` | HTTP response status code |
| `latency` | Request duration in ms |

### Filtering Logs

```bash
# All errors from API
docker compose logs api | grep '"level":"error"'

# Errors with stack traces (pipe through jq for readability)
docker compose logs api --tail 500 | grep '"level":"error"' | jq '{ msg, err, requestId, path }'

# Worker logs
docker compose logs worker-agent --tail 100 --follow

# Filter by request ID
docker compose logs api | grep '"requestId":"<id>"'
```

### Common Error Patterns

- `ECONNREFUSED` on port 5432 -- PostgreSQL down or not ready
- `ECONNREFUSED` on port 6379 -- Redis down
- `ETIMEDOUT` on Temporal address -- Temporal server unreachable
- `NoSuchBucket` -- MinIO bucket not created (run db-init or create manually)
- `connection pool exhausted` -- too many concurrent DB connections; check pool size
- `WORKFLOW_EXECUTION_ALREADY_STARTED` -- duplicate workflow dispatch; usually safe to ignore

---

## 4. Database Maintenance

### Connection Pool Monitoring

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'nova';

-- Connections by state
SELECT state, count(*) FROM pg_stat_activity WHERE datname = 'nova' GROUP BY state;

-- Long-running queries (> 30s)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE datname = 'nova' AND state != 'idle' AND now() - pg_stat_activity.query_start > interval '30 seconds';

-- Kill a specific query
SELECT pg_cancel_backend(<pid>);       -- graceful
SELECT pg_terminate_backend(<pid>);    -- force
```

### Vacuum & Reindex

```bash
# Run from host
docker compose exec postgres psql -U nova -d nova -c "VACUUM ANALYZE;"

# Reindex a specific table
docker compose exec postgres psql -U nova -d nova -c "REINDEX TABLE messages;"

# Check table bloat
docker compose exec postgres psql -U nova -d nova -c "
  SELECT relname, n_dead_tup, n_live_tup, last_vacuum, last_autovacuum
  FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;
"
```

### Migration Status

```bash
# Check applied migrations (Drizzle)
docker compose exec postgres psql -U nova -d nova -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10;"

# Generate new migration
bun run db:generate

# Apply pending migrations
bun run db:migrate

# Quick schema sync (dev only, no migration file)
bun run db:push
```

### Database Size

```sql
-- Total DB size
SELECT pg_size_pretty(pg_database_size('nova'));

-- Largest tables
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
```

---

## 5. Emergency Procedures

### Enable Maintenance Mode

Set via the admin portal at `http://localhost:5174` under Settings:

- Navigate to **Settings** and toggle `maintenance_mode` to `true`
- This is a platform setting stored in the database

### Kill All Stuck Workflows

```bash
# List all running workflows
docker compose exec temporal temporal workflow list --query "ExecutionStatus='Running'" --namespace default

# Batch terminate by org
docker compose exec temporal temporal workflow list \
  --query "NovaOrgId='<org-id>' AND ExecutionStatus='Running'" --namespace default \
  | awk '{print $1}' \
  | xargs -I {} docker compose exec temporal temporal workflow terminate --workflow-id {} --namespace default --reason "emergency cleanup"

# Nuclear option: terminate ALL running workflows
docker compose exec temporal temporal workflow list --query "ExecutionStatus='Running'" --namespace default --limit 1000 \
  | awk 'NR>1 {print $1}' \
  | xargs -I {} docker compose exec temporal temporal workflow terminate --workflow-id {} --namespace default --reason "emergency shutdown"
```

### Rollback a Deployment

```bash
# Check recent images
docker compose images

# Rollback to previous image (rebuild from previous commit)
git log --oneline -5
git checkout <previous-commit>
docker compose build api web worker-agent worker-ingestion worker-background
docker compose up -d api web worker-agent worker-ingestion worker-background

# Rollback database migration (manual -- Drizzle has no auto-rollback)
# Inspect the migration file, write a reverse SQL script, apply manually:
docker compose exec postgres psql -U nova -d nova -f /path/to/rollback.sql
```

### Emergency Service Restart

```bash
# Restart a single service
docker compose restart api
docker compose restart worker-agent

# Full stack restart (preserves volumes)
docker compose down && docker compose up -d

# Full stack nuke (DESTROYS DATA)
docker compose down -v && docker compose up -d
```

---

## 6. Useful Commands

### Docker Compose

```bash
# Follow logs for all services
docker compose logs -f

# Follow logs for specific services
docker compose logs -f api worker-agent

# Resource usage
docker stats --no-stream

# Exec into a container
docker compose exec api sh
docker compose exec postgres psql -U nova -d nova
```

### Temporal CLI

```bash
# Cluster health
docker compose exec temporal temporal operator cluster health

# List namespaces
docker compose exec temporal temporal operator namespace list

# Describe a workflow
docker compose exec temporal temporal workflow describe -w <workflow-id>

# Show workflow history
docker compose exec temporal temporal workflow show -w <workflow-id>

# List task queue pollers
docker compose exec temporal temporal task-queue describe --task-queue nova-agent

# Search workflows by custom attributes
docker compose exec temporal temporal workflow list --query "NovaExecutionTier='standard'"
docker compose exec temporal temporal workflow list --query "NovaAgentId='<agent-id>'"
```

### Common Database Queries

```sql
-- Recent conversations with message counts
SELECT c.id, c.title, count(m.id) as msg_count, c."createdAt"
FROM conversations c LEFT JOIN messages m ON m."conversationId" = c.id
GROUP BY c.id ORDER BY c."createdAt" DESC LIMIT 20;

-- Active organisations
SELECT id, name, slug, "createdAt" FROM organisations ORDER BY "createdAt" DESC LIMIT 10;

-- Users by org
SELECT u.name, u.email, m.role, o.name as org
FROM users u
JOIN members m ON m."userId" = u.id
JOIN organisations o ON o.id = m."organisationId"
ORDER BY o.name, m.role;

-- Check platform settings
SELECT * FROM platform_settings;

-- Model configuration
SELECT id, name, provider, "modelId", "isEnabled" FROM models WHERE "isEnabled" = true ORDER BY provider;
```

### Development Shortcuts

```bash
# Seed database
bun run --filter @nova/api db:seed

# Open Drizzle Studio
bun run db:studio

# Open Temporal UI
open http://localhost:8233

# Open MinIO Console
open http://localhost:9001
```

---

## 7. Observability

Nova includes an optional observability stack activated via Docker Compose profile. See `docs/OBSERVABILITY.md` for the full guide.

### Quick Start

```bash
docker compose --profile observability up -d
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| Grafana | 3002 | Dashboards and alerting (default login: admin/admin) |
| Prometheus | 9090 | Metrics collection and storage |
| Loki | 3100 | Log aggregation (queried via Grafana) |
| Tempo | 3200 | Distributed tracing |

### Dashboards

Grafana ships with 7 pre-configured dashboards covering API performance, worker health, database metrics, Redis usage, infrastructure overview, and more. Access at `http://your-server:3002`.

### Key Capabilities

- **Traces**: Tempo collects distributed traces across API requests and Temporal workflows. Use trace IDs to follow a request end-to-end.
- **Logs**: Loki aggregates structured JSON logs from all services. Filter by service, level, traceId, or any JSON field.
- **Metrics**: Prometheus scrapes Node.js, PostgreSQL, Redis, and MinIO exporters.

---

## 8. Backup Procedures

### Automated Database Backup

Use the provided backup script with cron for automated daily backups:

```bash
# Manual backup
./infra/scripts/db-backup.sh                          # Backup to ./backups/
./infra/scripts/db-backup.sh /mnt/backups             # Custom directory

# Restore from backup (interactive -- confirms before dropping DB)
./infra/scripts/db-restore.sh backups/nova_20260402_120000.sql.gz
```

### Cron Schedule

```bash
# Daily at 2 AM, 30-day retention (default)
0 2 * * * cd /path/to/nova && ./infra/scripts/db-backup.sh /mnt/backups >> /var/log/nova-backup.log 2>&1

# Custom retention: 14 days
0 2 * * * cd /path/to/nova && BACKUP_RETENTION_DAYS=14 ./infra/scripts/db-backup.sh /mnt/backups >> /var/log/nova-backup.log 2>&1
```

### Retention Policy

The backup script automatically cleans up backups older than `BACKUP_RETENTION_DAYS` (default: 30 days). Temporal DB should be backed up separately with a 14-day retention.

### Restore Procedure

1. Stop application services: `docker compose stop api gateway worker-agent worker-ingestion worker-background`
2. Run restore: `./infra/scripts/db-restore.sh <backup-file.sql.gz>`
3. Restart services: `docker compose up -d`
4. Verify with health check: `curl -s http://localhost:3000/health/ready | jq`

---

## 9. Alerting

### Pre-Configured Grafana Alerts

The observability stack includes pre-configured alert rules:

| Alert | Threshold | Severity |
|-------|-----------|----------|
| API error rate | > 5% of requests returning 5xx | Critical |
| P95 latency | > 5 seconds | Warning |
| Temporal workflow failures | > 10% failure rate | Critical |
| Memory usage | > 85% of container limit | Warning |

### Notification Channels

Configure alert notification channels in Grafana (Settings > Notification channels):
- Email, Slack, PagerDuty, webhooks, and others supported out of the box
- Alerts fire when thresholds are breached for 5 minutes (configurable)

### Health Endpoint Monitoring

In addition to Grafana alerts, set up an external uptime monitor on:
- `/health` -- basic liveness (should always return 200)
- `/health/ready` -- readiness with dependency checks (returns 503 when critical services are down)

---

## 10. Scaling Guidance

### When to Scale Workers

- **Task queue backlog growing**: Check Temporal UI at port 8233. If pending tasks consistently exceed 100 on any queue, add worker instances.
- **Workflow latency increasing**: If agent response times degrade, scale `worker-agent` first -- it handles the most resource-intensive work (LLM orchestration).

```bash
# Scale workers horizontally
docker compose up -d --scale worker-agent=3 --scale worker-ingestion=2
```

### Database Connection Pool Tuning

- Default PostgreSQL `max_connections` is 100. Each API instance and worker uses a connection pool.
- Monitor active connections: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'nova';`
- If connections approach the limit, either increase `max_connections` in PostgreSQL config or use PgBouncer as a connection pooler.
- Rule of thumb: allow 10 connections per API instance + 5 per worker instance + 20 headroom.

### Redis Memory Monitoring

```bash
# Check current memory usage
docker compose exec redis redis-cli info memory | grep used_memory_human

# Check eviction policy
docker compose exec redis redis-cli config get maxmemory-policy
```

- Redis is used for cache, pub/sub (stream relay), and rate limiting. It is ephemeral by design.
- If memory usage grows above 80% of available RAM, investigate for leaked stream-event lists: `docker compose exec redis redis-cli DBSIZE`
- Stream event lists (`stream-events:{channelId}`) are cleaned up after delivery but can accumulate if clients disconnect without consuming.

---

## 11. Incident Response

### First Steps

1. **Check Grafana dashboards** at `http://your-server:3002` for an overview of system health, error rates, and latency.
2. **Check health endpoint**: `curl -s http://your-server:3000/health/ready | jq` -- identifies which dependencies are down.
3. **Check container status**: `docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"`

### Tracing Slow Requests

1. Find the `requestId` from API logs or the `X-Request-Id` response header.
2. In Grafana, go to the Tempo data source and search by trace ID.
3. The trace shows the full request lifecycle: middleware, database queries, Redis calls, and any downstream service calls.

### Correlating Logs with Traces

1. In Grafana, navigate to the Loki data source (Explore view).
2. Filter by `traceId` to see all log entries for a specific request:
   ```
   {service="api"} | json | traceId="<trace-id>"
   ```
3. This shows the complete log trail including errors, warnings, and timing information.

### Common Incident Patterns

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| 503 on `/health/ready` | PostgreSQL or Redis down | `docker compose restart postgres redis` |
| High P95 latency | Slow DB queries or LLM provider issues | Check Tempo traces; check `pg_stat_activity` for long queries |
| Worker not processing | Worker disconnected from Temporal | `docker compose restart worker-agent` and check Temporal task queue pollers |
| Streaming stalled | Redis pub/sub issue or SSE connection dropped | Check Redis connectivity; restart API if needed |
| OOM kills | Worker processing too many concurrent LLM calls | Scale workers or reduce concurrency; check `docker stats` |

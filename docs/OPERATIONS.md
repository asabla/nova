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

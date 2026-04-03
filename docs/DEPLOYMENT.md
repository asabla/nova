# Production Deployment Guide

## Prerequisites

### Hardware

| Role | CPU | RAM | Disk | Notes |
|------|-----|-----|------|-------|
| Minimum (all-in-one) | 4 cores | 16 GB | 100 GB SSD | Small team, low traffic |
| Recommended | 8 cores | 32 GB | 250 GB SSD | Medium workloads |

Workers are CPU/memory-intensive during LLM orchestration. Size disk for PostgreSQL, RustFS file storage, and Qdrant vectors.

### Software

- Docker Engine 24+ and Docker Compose v2.20+
- A domain with DNS A record pointing to the server
- (Optional) `certbot` for Let's Encrypt TLS, or a cloud load balancer

### Port Summary

| Service | Port | Exposure |
|---------|------|----------|
| Web (nginx) | 80 / 443 | Public |
| API | 3000 | Internal (proxied via nginx) |
| Gateway | 3001 | Internal only |
| PostgreSQL | 5432 | Internal only |
| Redis | 6379 | Internal only |
| RustFS | 9000 / 9001 | Internal (proxied via nginx at `/storage/`) |
| Qdrant | 6333 / 6334 | Internal only |
| Temporal | 7233 | Internal only |
| Temporal UI | 8233 | Internal (admin access only) |
| SearxNG | 8888 | Internal only |

In production, remove host port mappings for internal services in `docker-compose.yml` (or use a production override file) so only nginx is exposed.

---

## Deployment Scenarios

Nova supports three deployment scenarios:

### 1. Local Development

Run infrastructure in Docker and application services via Bun/Node.js for hot-reload:

```bash
docker compose up -d postgres redis minio qdrant temporal temporal-db searxng
bun run dev        # Starts API, web, admin, and workers with hot-reload
```

### 2. Self-Hosted Production

Use the production override file, which enforces required secrets via `:?` validation and removes host port mappings for internal services:

```bash
# Copy and fill in production secrets
cp .env.example .env.production

# Start with production overrides
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

The `docker-compose.production.yml` file requires the following env vars (will fail to start if missing):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public URL for auth callbacks |
| `CORS_ORIGINS` | Allowed CORS origins |
| `APP_URL` | Public application URL |
| `MINIO_ENDPOINT` | RustFS/S3 endpoint |
| `MINIO_PUBLIC_URL` | Public RustFS URL for presigned URLs |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Object storage credentials |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials |
| `TEMPORAL_DB_PASSWORD` | Temporal database password |
| `NOVA_GATEWAY_JWT_SECRET` | Internal gateway JWT secret |

Resource limits are set in the production override: API gets 2GB/4 CPU, each worker gets 4GB/4 CPU, web/admin get 256MB/0.5 CPU.

### 3. Enterprise (Self-Managed Hardware)

Same as self-hosted production, but the customer brings their own infrastructure. Key differences:

- May use managed PostgreSQL (RDS, Cloud SQL) and managed Redis (ElastiCache, Memorystore) instead of containerized instances
- May bring their own monitoring stack -- Nova exports OTLP traces that can be routed to any compatible collector
- Temporal UI is disabled by default in production (moved to the `debug` profile); enable selectively behind auth

---

## Observability Stack (Optional)

An optional observability profile adds a full monitoring stack:

```bash
docker compose --profile observability up -d
```

This starts:

| Service | Port | Purpose |
|---------|------|---------|
| Grafana | 3002 | Dashboards and alerting |
| Prometheus | 9090 | Metrics collection |
| Loki | 3100 | Log aggregation |
| Tempo | 3200 | Distributed tracing |
| Alloy | -- | Telemetry pipeline (collects and forwards) |
| Exporters (x4) | -- | PostgreSQL, Redis, RustFS, Node.js metrics |

See `docs/OBSERVABILITY.md` for the full observability guide including dashboard descriptions and alert configuration.

---

## Quick Start (Docker Compose)

### 1. Clone and configure environment

```bash
git clone <repo-url> nova && cd nova
cp .env.example .env
```

Edit `.env` with production values:

```bash
NODE_ENV=production
APP_URL=https://your-domain.com
BETTER_AUTH_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com
ADMIN_CORS_ORIGIN=https://admin.your-domain.com,https://your-domain.com
LOG_LEVEL=info
```

### 2. Generate secrets

```bash
# Auth secret (required)
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env

# Gateway JWT secret (required)
echo "NOVA_GATEWAY_JWT_SECRET=$(openssl rand -base64 32)" >> .env

# PostgreSQL password (replace default)
# Update both DATABASE_URL and the postgres service environment in docker-compose.yml
echo "DATABASE_URL=postgres://nova:$(openssl rand -base64 16)@postgres:5432/nova" >> .env
```

### 3. Configure LLM providers

Set at least one provider key in `.env`:

```bash
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

Additional providers can be configured through the Nova UI after first login.

### 4. Build and start

```bash
# Build all images (including sandbox)
docker compose build

# Start infrastructure first
docker compose up -d postgres redis minio qdrant temporal temporal-db searxng

# Wait for infrastructure, then init
docker compose up -d temporal-init db-init sandbox-python sandbox-init

# Start application services
docker compose up -d api gateway web admin worker-agent worker-ingestion worker-background
```

Or start everything at once (dependency ordering is handled by `depends_on`):

```bash
docker compose up -d
```

### 5. Verify

```bash
# Check all services are running
docker compose ps

# Health check
curl -s https://your-domain.com/health | jq
curl -s https://your-domain.com/health/ready | jq

# Run full diagnostics (POST)
curl -s -X POST https://your-domain.com/api/health/diagnostics | jq
```

The `/health/ready` endpoint checks PostgreSQL, Redis, RustFS, and Temporal connectivity. Returns `200` when healthy, `503` when critical services (database, redis) are down.

---

## TLS / HTTPS

### Option A: nginx TLS termination (self-managed)

1. Obtain certificates with certbot:

```bash
# Install certbot
apt install certbot

# Standalone mode (stop nginx first, or use webroot)
certbot certonly --standalone -d your-domain.com
```

2. Mount certificates into the web container. Add to the `web` service in `docker-compose.yml`:

```yaml
web:
  volumes:
    - /etc/letsencrypt/live/your-domain.com/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
    - /etc/letsencrypt/live/your-domain.com/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
  ports:
    - "443:443"
    - "80:80"   # For HTTP->HTTPS redirect
```

3. Uncomment the HTTPS server block in `infra/docker/nginx.conf` (the TLS configuration with HSTS, OCSP stapling, and TLS 1.2/1.3 is already templated there). Add an HTTP-to-HTTPS redirect in the port 80 block:

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

4. Set up auto-renewal:

```bash
# Cron: renew and reload nginx
0 3 * * * certbot renew --quiet && docker compose exec web nginx -s reload
```

### Option B: Cloud load balancer

Terminate TLS at the load balancer (AWS ALB, GCP LB, Cloudflare, etc.) and proxy to nginx on port 80. Keep the HTTP-only nginx config as-is. Ensure `X-Forwarded-Proto` is passed through so the app detects HTTPS correctly.

---

## Secrets Management

### Required secrets

| Secret | How to generate | Where used |
|--------|----------------|------------|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Session signing, auth tokens |
| `NOVA_GATEWAY_JWT_SECRET` | `openssl rand -base64 32` | Internal gateway auth |
| PostgreSQL password | `openssl rand -base64 16` | `DATABASE_URL`, `docker-compose.yml` postgres env |
| RustFS credentials | Custom strong password | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` |

### Defaults that must be changed

The following ship with insecure defaults for development convenience:

- **PostgreSQL**: `nova:nova` -- change `POSTGRES_PASSWORD` in both the `postgres` and `temporal-db` services, plus `DATABASE_URL`
- **RustFS**: `minioadmin:minioadmin` -- change `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` in all services that reference them (api, gateway, workers, db-init, minio)
- **`BETTER_AUTH_SECRET`**: `change-me-in-production-use-openssl-rand-base64-32`

### Rotation

Rotate `BETTER_AUTH_SECRET` by updating `.env` and restarting the API. This invalidates all existing sessions (users must re-login). Rotate `NOVA_GATEWAY_JWT_SECRET` similarly -- restart the API and gateway together.

---

## Scaling

### Stateless services (horizontally scalable)

- **API** -- run multiple instances behind a load balancer. Session state is in PostgreSQL; cache/pub-sub is in Redis.
- **Workers** -- scale by running additional containers. Each worker type processes its own Temporal task queue (`nova-agent`, `nova-ingestion`, `nova-background`). Temporal distributes tasks across all workers polling the same queue.
- **Web / Admin** -- static files served by nginx. Scale trivially or use a CDN.
- **Gateway** -- stateless, scale as needed.

```bash
# Scale workers
docker compose up -d --scale worker-agent=3 --scale worker-ingestion=2
```

### Stateful services (scale vertically, or use managed services)

| Service | Scaling strategy |
|---------|-----------------|
| PostgreSQL | Vertical scaling, read replicas, or managed (RDS, Cloud SQL) |
| Redis | Vertical scaling or managed (ElastiCache, Memorystore) |
| RustFS | Distributed mode or switch to S3/GCS |
| Qdrant | Qdrant Cloud or distributed deployment |
| Temporal | Temporal Cloud or self-hosted cluster mode |

### Worker task queues

Workers register on specific Temporal task queues defined in `@nova/shared/constants`:

- `nova-agent` -- chat execution, tool use, DAG orchestration
- `nova-ingestion` -- document/file/message embedding
- `nova-background` -- research, summaries, cleanup, scheduling

Scale each independently based on workload.

---

## Backup & Recovery

### PostgreSQL

Automated backup and restore scripts are provided:

```bash
# Automated backup (compressed, with retention cleanup)
./infra/scripts/db-backup.sh                          # Backup to ./backups/
./infra/scripts/db-backup.sh /mnt/backups             # Custom directory
BACKUP_RETENTION_DAYS=14 ./infra/scripts/db-backup.sh # Custom retention (default: 30 days)

# Automated restore (interactive confirmation, drops and recreates DB)
./infra/scripts/db-restore.sh backups/nova_20260402_120000.sql.gz

# Cron example: daily backup at 2 AM
0 2 * * * cd /path/to/nova && ./infra/scripts/db-backup.sh /mnt/backups >> /var/log/nova-backup.log 2>&1
```

Manual backup/restore via Docker:

```bash
# Backup (from host)
docker compose exec postgres pg_dump -U nova -Fc nova > nova_$(date +%Y%m%d).dump

# Backup Temporal DB separately
docker compose exec temporal-db pg_dump -U nova -Fc temporal > temporal_$(date +%Y%m%d).dump

# Restore
docker compose exec -i postgres pg_restore -U nova -d nova --clean < nova_20260330.dump
```

### RustFS (file storage)

```bash
# Install mc (RustFS client) on host
# Configure alias
mc alias set nova http://localhost:9000 minioadmin minioadmin

# Mirror to backup location
mc mirror nova/nova-files /backups/minio/nova-files

# Restore
mc mirror /backups/minio/nova-files nova/nova-files
```

### Qdrant (vector store)

```bash
# Create snapshot
curl -X POST http://localhost:6333/collections/{collection_name}/snapshots

# List snapshots
curl http://localhost:6333/collections/{collection_name}/snapshots

# Download snapshot
curl http://localhost:6333/collections/{collection_name}/snapshots/{snapshot_name} -o qdrant_snapshot.tar
```

Qdrant vectors can be re-generated from source documents by re-running ingestion workflows if snapshots are lost.

### Redis

Redis is used for cache and pub/sub -- it is ephemeral by design. The `redis_data` volume provides persistence across restarts, but Redis does not need dedicated backup. Lost cache data is rebuilt on demand.

### Backup schedule recommendation

| Data | Frequency | Retention |
|------|-----------|-----------|
| PostgreSQL | Daily + before upgrades | 30 days |
| Temporal DB | Daily | 14 days |
| RustFS | Daily incremental | 30 days |
| Qdrant | Weekly | 7 days (re-generable) |

---

## Monitoring

### Health endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | None | Basic liveness (`{"status":"ok"}`) |
| `/health/ready` | GET | None | Readiness with dependency checks (DB, Redis, RustFS, Temporal) |
| `/health/system` | GET | None | Runtime info (version, memory, uptime) |
| `/api/health/diagnostics` | POST | None | Full diagnostic suite (DB extensions, LLM providers, DNS) |

### Key metrics to alert on

- `/health/ready` returning `503` -- critical service down
- Container restart count > 0 (check with `docker compose ps`)
- PostgreSQL connection count approaching `max_connections`
- Redis memory usage (`redis-cli INFO memory`)
- Disk usage on volumes (especially `postgres_data`, `minio_data`, `qdrant_data`)
- Worker lag -- check Temporal UI at port 8233 for task queue backlogs
- API response times via nginx access logs

### Temporal UI

Access at `http://your-server:8233` (restrict to internal network). Monitor workflow execution, failure rates, and task queue depths.

### Log aggregation

All services log to stdout/stderr. Collect with your preferred stack:

```bash
# View logs
docker compose logs -f api
docker compose logs -f worker-agent worker-ingestion worker-background

# Follow all
docker compose logs -f --tail=100
```

For production, pipe to a log aggregator (Loki, ELK, Datadog, etc.) via Docker logging drivers.

---

## Production Checklist

Before going live, verify the following:

- [ ] **`BETTER_AUTH_SECRET`** is not the default value (`change-me-in-production-use-openssl-rand-base64-32`). Generate with `openssl rand -base64 32`
- [ ] **`CORS_ORIGINS`** is set to your exact production domain(s), not `*` or `localhost`
- [ ] **PostgreSQL password** is changed from the default `nova:nova` in both `DATABASE_URL` and the `postgres` service
- [ ] **RustFS credentials** are changed from `minioadmin:minioadmin`
- [ ] **Redis persistence** is enabled -- the production override sets `appendonly yes` with `appendfsync everysec`
- [ ] **Source maps** are disabled in Vite production builds (default behavior; verify `GENERATE_SOURCEMAP` is not set to `true`)
- [ ] **Host port mappings** are removed for internal services (the production override handles this with `ports: !reset []`)
- [ ] **Temporal UI** is disabled or behind authentication (production override moves it to the `debug` profile)
- [ ] **TLS** is configured via nginx or a cloud load balancer
- [ ] **Backup schedule** is configured (see Backup & Recovery section above)
- [ ] **Health check** returns 200: `curl -s https://your-domain.com/health/ready | jq`

---

## Updating

### Standard update procedure

```bash
cd /path/to/nova

# 1. Pull latest code
git pull origin main

# 2. Rebuild images
docker compose build

# 3. Run database migrations
docker compose up -d db-init

# 4. Restart services (rolling)
docker compose up -d api gateway web admin
docker compose up -d worker-agent worker-ingestion worker-background

# 5. Verify
curl -s https://your-domain.com/health/ready | jq
```

### Zero-downtime considerations

- Workers can be restarted without downtime -- Temporal will retry in-progress activities on the new worker instances.
- API instances behind a load balancer can be rolled one at a time.
- The `web` and `admin` services serve static files and restart in seconds.
- Always run `db-init` (migrations) before starting updated API/worker containers.

### Rollback

```bash
# Revert to previous version
git checkout <previous-tag-or-commit>
docker compose build
docker compose up -d

# If migration rollback is needed, restore from PostgreSQL backup
```

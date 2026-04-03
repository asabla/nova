# NOVA -- Infrastructure Plan

---

## Docker Compose (Local Development)

### Services

| Service | Image | Ports | Volume | Health Check |
|---------|-------|-------|--------|-------------|
| **postgres** | `postgres:16-alpine` | 5432 | `nova-pgdata:/var/lib/postgresql/data` | `pg_isready -U nova` |
| **postgres-temporal** | `postgres:16-alpine` | 5433 | `temporal-pgdata:/var/lib/postgresql/data` | `pg_isready -U temporal` |
| **redis** | `redis:7.2-alpine` | 6379 | `redis-data:/data` | `redis-cli ping` |
| **minio** | `minio/minio:RELEASE.2026-03-01T00-00-00Z` | 9000 (API), 9001 (Console) | `minio-data:/data` | `mc ready local` |
| **litellm** | `ghcr.io/berriai/litellm:main-v1.x.x` | 4000 | `./litellm_config.yaml:/app/config.yaml` | `curl -f http://localhost:4000/health` |
| **temporal** | `temporalio/auto-setup:1.24.x` | 7233 | none | `tctl cluster health` |
| **temporal-ui** | `temporalio/ui:2.x` | 8233 | none | `curl -f http://localhost:8080` |
| **langfuse** | `langfuse/langfuse:3.x` | 3100 | none | `curl -f http://localhost:3100/api/public/health` |
| **otel-collector** | `otel/opentelemetry-collector-contrib:0.96.0` | 4317 (gRPC), 4318 (HTTP) | `./infra/otel-config.yaml:/etc/otelcol-contrib/config.yaml` | built-in |
| **prometheus** | `prom/prometheus:v2.50.0` | 9090 | `./infra/prometheus.yml:/etc/prometheus/prometheus.yml` | built-in |
| **grafana** | `grafana/grafana:10.x` | 3200 | `grafana-data:/var/lib/grafana` | `curl -f http://localhost:3200/api/health` |
| **api** | `build: packages/api` | 3000 | source code (dev mount) | `curl -f http://localhost:3000/health` |
| **worker** | `build: packages/worker` | none | source code (dev mount) | Temporal worker heartbeat |
| **web** | `build: packages/web` | 5173 | source code (dev mount) | Vite dev server |

### Startup Dependency Order

```
postgres, postgres-temporal, redis, minio
    |
    v
litellm, temporal (depends on postgres-temporal), langfuse (depends on postgres), otel-collector
    |
    v
api (depends on postgres, redis, minio, litellm, temporal, otel-collector)
    |
    v
worker (depends on temporal, postgres, redis, minio, litellm)
    |
    v
web (depends on api)
```

### Docker Compose Skeleton

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: nova
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-nova_dev}
      POSTGRES_DB: nova
    volumes:
      - nova-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nova"]
      interval: 5s
      retries: 5

  postgres-temporal:
    image: postgres:16-alpine
    ports: ["5433:5432"]
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: ${TEMPORAL_DB_PASSWORD:-temporal_dev}
      POSTGRES_DB: temporal
    volumes:
      - temporal-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U temporal"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7.2-alpine
    ports: ["6379:6379"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  minio:
    image: minio/minio:RELEASE.2026-03-01T00-00-00Z
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-nova_minio}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-nova_minio_dev}
    volumes:
      - minio-data:/data
    command: server /data --console-address ":9001"

  litellm:
    image: ghcr.io/berriai/litellm:main-v1.x.x  # Pin to specific tag
    ports: ["4000:4000"]
    environment:
      LITELLM_MASTER_KEY: ${LITELLM_MASTER_KEY:-sk-nova-dev}
      DATABASE_URL: postgresql://nova:${POSTGRES_PASSWORD:-nova_dev}@postgres:5432/nova
      LANGFUSE_PUBLIC_KEY: ${LANGFUSE_PUBLIC_KEY:-}
      LANGFUSE_SECRET_KEY: ${LANGFUSE_SECRET_KEY:-}
      LANGFUSE_HOST: http://langfuse:3100
    volumes:
      - ./infra/litellm_config.yaml:/app/config.yaml
    command: ["--config", "/app/config.yaml"]
    depends_on:
      postgres:
        condition: service_healthy

  temporal:
    image: temporalio/auto-setup:1.24.x  # Pin to specific tag
    ports: ["7233:7233"]
    environment:
      DB: postgresql
      DB_PORT: 5432
      POSTGRES_USER: temporal
      POSTGRES_PWD: ${TEMPORAL_DB_PASSWORD:-temporal_dev}
      POSTGRES_SEEDS: postgres-temporal
    depends_on:
      postgres-temporal:
        condition: service_healthy

  temporal-ui:
    image: temporalio/ui:2.x
    ports: ["8233:8080"]
    environment:
      TEMPORAL_ADDRESS: temporal:7233
    depends_on:
      - temporal

  langfuse:
    image: langfuse/langfuse:3.x  # Pin to specific tag
    ports: ["3100:3000"]
    environment:
      DATABASE_URL: postgresql://nova:${POSTGRES_PASSWORD:-nova_dev}@postgres:5432/langfuse
      NEXTAUTH_SECRET: ${LANGFUSE_NEXTAUTH_SECRET:-langfuse-dev-secret}
      NEXTAUTH_URL: http://localhost:3100
      SALT: ${LANGFUSE_SALT:-langfuse-dev-salt}
    depends_on:
      postgres:
        condition: service_healthy

  prometheus:
    image: prom/prometheus:v2.50.0
    ports: ["9090:9090"]
    volumes:
      - ./infra/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:10.4.0
    ports: ["3200:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  nova-pgdata:
  temporal-pgdata:
  redis-data:
  minio-data:
  grafana-data:
```

---

## Environment Variable Matrix

| Variable | Used By | Example Value | Secret? | Notes |
|----------|---------|--------------|---------|-------|
| `POSTGRES_PASSWORD` | postgres, api, worker, litellm | `nova_dev` | Yes | NOVA database password |
| `TEMPORAL_DB_PASSWORD` | postgres-temporal, temporal | `temporal_dev` | Yes | Temporal database password |
| `REDIS_URL` | api, worker | `redis://redis:6379` | No | |
| `DATABASE_URL` | api, worker | `postgresql://nova:pass@postgres:5432/nova` | Yes | NOVA PostgreSQL connection |
| `MINIO_ENDPOINT` | api, worker | `http://minio:9000` | No | |
| `MINIO_ROOT_USER` | minio, api, worker | `nova_minio` | Yes | |
| `MINIO_ROOT_PASSWORD` | minio, api, worker | `nova_minio_dev` | Yes | |
| `MINIO_BUCKET` | api, worker | `nova-files` | No | Default bucket name |
| `LITELLM_API_URL` | api, worker | `http://litellm:4000` | No | |
| `LITELLM_MASTER_KEY` | litellm, api | `sk-nova-dev` | Yes | |
| `TEMPORAL_ADDRESS` | api, worker | `temporal:7233` | No | |
| `BETTER_AUTH_SECRET` | api | `random-32-byte-hex` | Yes | Session signing key |
| `BETTER_AUTH_URL` | api | `http://localhost:3000` | No | |
| `LANGFUSE_PUBLIC_KEY` | litellm, api | `pk-lf-...` | No | LangFuse project key |
| `LANGFUSE_SECRET_KEY` | litellm, api | `sk-lf-...` | Yes | |
| `LANGFUSE_HOST` | litellm, api | `http://langfuse:3100` | No | |
| `AZURE_AD_CLIENT_ID` | api | `uuid` | No | For Entra ID SSO |
| `AZURE_AD_CLIENT_SECRET` | api | `secret` | Yes | |
| `AZURE_AD_TENANT_ID` | api | `uuid` | No | |

---

## Local Dev Experience

```bash
# Start all infrastructure services
bun run dev:infra    # docker compose up -d (infra only)

# Run API + Worker + Web in dev mode
bun run dev          # starts api (Bun), worker (Node.js), web (Vite) concurrently

# Database operations
bun run db:migrate   # drizzle-kit push (applies migrations)
bun run db:seed      # seeds: 1 org, 2 users (admin + member), sample conversation, sample agent
bun run db:studio    # drizzle-kit studio (visual DB browser)

# Testing
bun run test         # runs all tests (bun test for api/web/shared, node for worker)
bun run test:api     # API tests only
bun run test:web     # Frontend tests only
bun run test:worker  # Worker tests only (Node.js)

# Linting & formatting
bun run lint         # eslint + prettier check
bun run typecheck    # tsc --noEmit across all packages
```

### Seed Data

The development seed creates:
- 1 organisation: "NOVA Dev Org"
- 2 users: admin@nova.dev (org-admin), user@nova.dev (member)
- Password for both: `password123` (dev only!)
- 1 workspace: "Default Workspace"
- 1 sample conversation with 3 messages
- 1 sample agent: "Research Assistant" with web search tool
- 1 sample knowledge collection with 2 documents
- 1 sample prompt template

---

## Kubernetes (Production)

### Service Topology

| Service | Replicas | CPU Req/Limit | Memory Req/Limit | HPA | Notes |
|---------|----------|--------------|-----------------|-----|-------|
| api | 2-10 | 250m/1000m | 512Mi/2Gi | Yes (CPU 70%) | Bun, stateless |
| worker | 2-5 | 500m/2000m | 1Gi/4Gi | Yes (queue depth) | Node.js, Temporal worker |
| web | 2-4 | 100m/500m | 256Mi/1Gi | Yes (CPU 70%) | Nginx serving static build |
| postgres | 1 (primary) | 1000m/4000m | 2Gi/8Gi | No | PVC: 100Gi SSD |
| postgres-temporal | 1 | 500m/2000m | 1Gi/4Gi | No | PVC: 20Gi SSD |
| redis | 1 (Sentinel for HA) | 250m/1000m | 512Mi/2Gi | No | PVC: 10Gi |
| minio | 4 (erasure coding) | 500m/2000m | 1Gi/4Gi | No | PVC: 500Gi each |
| litellm | 2-4 | 250m/1000m | 512Mi/2Gi | Yes (CPU 70%) | Stateless |
| temporal | 1-3 | 500m/2000m | 2Gi/4Gi | No | |
| langfuse | 1-2 | 250m/1000m | 512Mi/2Gi | No | |
| prometheus | 1 | 250m/1000m | 1Gi/4Gi | No | PVC: 50Gi |
| grafana | 1 | 100m/500m | 256Mi/1Gi | No | |

### Ingress

- Single ingress controller (nginx-ingress or Traefik)
- TLS via cert-manager + Let's Encrypt
- Routes: `nova.example.com` -> web, `nova.example.com/api/*` -> api, `nova.example.com/ws` -> api (WebSocket upgrade)

### Secrets Management

- External Secrets Operator pulling from:
  - AWS Secrets Manager (cloud)
  - HashiCorp Vault (self-hosted)
- All secrets are Kubernetes Secrets referenced via env vars
- Never store secrets in ConfigMaps or Docker images

---

## Firecracker Deployment Notes

### Host Requirements
- KVM access required (`/dev/kvm` must exist)
- Bare metal recommended: Hetzner AX-series, AWS `.metal` instances
- Nested virtualization: Works on standard AWS Nitro instances and some cloud VMs
- Linux kernel 5.10+ recommended

### VM Image Build Process
1. Build minimal rootfs using Alpine Linux (~50MB base)
2. Add language runtimes: Python 3.12, Node.js 20, Bash
3. Include common packages: numpy, pandas, matplotlib (Python), lodash (Node.js)
4. Compress as ext4 filesystem image
5. Store in RustFS for fast retrieval

### Pool Management
- Pre-warm pool of 5-20 VMs (configurable per deployment)
- Each VM is single-use: execute code, collect results, destroy
- Snapshot-based fast restore (~100ms boot from snapshot)
- Dedicated management service handles allocation and cleanup
- Metrics: pool size, utilization, average boot time, timeout rate

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: nova
          POSTGRES_PASSWORD: test
          POSTGRES_DB: nova_test
        ports: ["5432:5432"]
      redis:
        image: redis:7.2-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20  # For worker tests
      - run: bun install --frozen-lockfile
      - run: bun run db:migrate
        env:
          DATABASE_URL: postgresql://nova:test@localhost:5432/nova_test
      - run: bun run test
        env:
          DATABASE_URL: postgresql://nova:test@localhost:5432/nova_test
          REDIS_URL: redis://localhost:6379

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build

  docker-build:
    needs: [build]
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: packages/api/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/api:${{ github.sha }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: packages/worker/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/worker:${{ github.sha }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: packages/web/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/web:${{ github.sha }}

  deploy-staging:
    needs: [docker-build]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy to staging via kubectl rollout"
      # kubectl set image deployment/api api=ghcr.io/.../api:${{ github.sha }}

  deploy-prod:
    needs: [docker-build]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Deploy to production via kubectl rollout"
```

### Pipeline Summary

1. **lint** -- eslint + prettier check
2. **typecheck** -- tsc --noEmit across all packages
3. **test** -- bun test (api/web/shared) + node test (worker) with real PostgreSQL + Redis
4. **build** -- bun build all packages
5. **docker-build** -- build and push images to GHCR (main branch + tags only)
6. **deploy-staging** -- kubectl rollout (on push to main)
7. **deploy-prod** -- kubectl rollout (on semver tag, requires approval)

---

## Single Points of Failure

| Component | SPOF Risk | Mitigation | Phase |
|-----------|-----------|------------|-------|
| PostgreSQL (NOVA) | High | Phase 5: Streaming replication + pgBouncer | 5 |
| PostgreSQL (Temporal) | Medium | Temporal Cloud as managed alternative | 5 |
| Redis | Medium | Phase 5: Redis Sentinel (3-node) | 5 |
| RustFS | Medium | Phase 5: Erasure coding (4+ nodes) | 5 |
| Temporal Server | Medium | Multi-replica + separate DB | 5 |
| LiteLLM | Low (stateless) | 2+ replicas behind load balancer | 2 |
| API Server | Low (stateless) | 2+ replicas behind ingress | 1 |

---

## Monitoring & Alerting

### Key Metrics to Alert On
- API error rate > 5% (5xx responses)
- API latency p99 > 2s
- SSE stream count > 1000 per pod (memory pressure risk)
- WebSocket connections > 5000 per pod
- PostgreSQL connection count > 80% of max
- Redis memory usage > 80%
- RustFS disk usage > 80%
- Temporal workflow failure rate > 5%
- LiteLLM 429 rate > 10% (upstream rate limiting)
- Bun process RSS > 2GB (potential memory leak)

### Grafana Dashboards (Pre-built)
- NOVA Overview: request rate, error rate, latency, active users
- LLM Usage: tokens/minute, cost/hour, model distribution, latency by provider
- Infrastructure: CPU, memory, disk, network per service
- Temporal Workflows: active, completed, failed, latency by workflow type

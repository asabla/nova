# NOVA

> The self-hosted AI platform built for teams.

NOVA is a self-hosted-first, multi-tenant AI chat platform with custom agents, knowledge collections, and sandboxed code execution.

**License:** FSL-1.1-Apache-2.0

## Architecture

Bun workspace monorepo with 11 packages:

- **@nova/shared** — Drizzle schemas (75 tables), types, constants, utils, skills
- **@nova/api** — Hono + Bun API server (REST, SSE, WebSocket)
- **@nova/web** — React 19 + Vite + Tailwind v4 + TanStack Router + TanStack Query + Zustand
- **@nova/admin** — Separate admin portal (React 19 + Vite + TanStack Router, port 5174)
- **@nova/worker-shared** — Shared worker infrastructure (db, redis, litellm, stream-publisher, qdrant, minio, sandbox, tools)
- **@nova/worker-agent** — Temporal agent workflows (task queue: `nova-agent`). Chat execution, tool use, DAG orchestration
- **@nova/worker-ingestion** — Temporal ingestion workflows (task queue: `nova-ingestion`). Document/file/message embedding pipelines
- **@nova/worker-background** — Temporal background workflows (task queue: `nova-background`). Research, summaries, cleanup, scheduling
- **@nova/gateway** — Internal infrastructure API for workers
- **@nova/protocol** — Shared protocol definitions
- **@nova/sdk-ts** — TypeScript SDK

All worker packages run on **Node.js** (not Bun) — Temporal requires it.

## Prerequisites

- [Bun](https://bun.sh/) >= 1.x
- [Docker](https://www.docker.com/) + Docker Compose
- Node.js 22+ (for worker packages only — Temporal requires it)
- GNU Make (optional, but recommended)

## Quick Start

The fastest way to get up and running:

```bash
cp .env.example .env          # Configure environment
bun install                   # Install dependencies
make setup                    # Start infra, run migrations, seed DB
make dev                      # Start all dev servers
```

This starts all packages concurrently:
- **API** → http://localhost:3000
- **Web** → http://localhost:5173
- **Admin** → http://localhost:5174
- **Workers** (agent, ingestion, background) → connect to Temporal at localhost:7233

### Manual setup (without Make)

```bash
docker compose up -d postgres redis minio temporal temporal-db temporal-ui qdrant searxng
bun run db:push
bun run --filter @nova/api db:seed
bun run dev
```

### Individual packages

```bash
bun run dev:api              # API only
bun run dev:web              # Web only
bun run dev:workers          # All 3 workers
bun run dev:worker:agent     # Agent worker only
bun run dev:worker:ingestion # Ingestion worker only
bun run dev:worker:background # Background worker only
```

## Make Targets

Run `make help` for all available targets. Highlights:

| Target | Description |
|--------|-------------|
| `make setup` | Start infra, run migrations, seed DB |
| `make dev` | Run all packages locally |
| `make infra` | Start infrastructure services only |
| `make build` | Build all app containers |
| `make deploy` | Build and start all app containers |
| `make test` | Run all tests |
| `make typecheck` | Run TypeScript type checking |
| `make db-push` | Push schema directly (dev shortcut) |
| `make db-studio` | Open Drizzle Studio |
| `make storybook` | Start Storybook dev server |
| `make observability` | Start Grafana + Prometheus + Loki + Tempo |
| `make observability-down` | Stop observability stack |
| `make clean-volumes` | Stop everything and destroy data |

## Build

```bash
bun run build       # Build all packages
bun run typecheck   # TypeScript check all packages
bun test            # Run all tests
```

## Docker

Build and deploy all services:

```bash
make deploy
# or manually:
docker compose build api web worker-agent worker-ingestion worker-background
docker compose up -d
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Web | 5173 | Frontend (nginx) |
| Admin | 5174 | Admin portal (nginx) |
| API | 3000 | Backend API (Hono + Bun) |
| PostgreSQL | 5432 | Database (pg_trgm) |
| Redis | 6379 | Cache, pub/sub, rate limiting |
| MinIO | 9000/9001 | S3-compatible file storage |
| Qdrant | 6333/6334 | Vector search engine |
| Temporal | 7233 | Workflow orchestration |
| Temporal UI | 8233 | Temporal dashboard |
| SearxNG | 8888 | Web search |

### Observability (optional)

Start with `make observability` or `docker compose --profile observability up -d`:

| Service | Port | Description |
|---------|------|-------------|
| Grafana | 3002 | Dashboards, alerting, exploration |
| Prometheus | 9090 | Metrics collection (8 scrape targets) |
| Loki | 3100 | Log aggregation |
| Tempo | 3200 | Distributed tracing |
| Alloy | 4317/4318 | OTLP collector + Docker log tailing |

## Storybook

```bash
make storybook
# or: bun run storybook
```

Component library dev server runs on http://localhost:6006.

## Environment Variables

See [`.env.example`](.env.example) for all available configuration options.

Required for production:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `BETTER_AUTH_SECRET` — Auth secret (min 32 chars)
- `BETTER_AUTH_URL` — API base URL
- At least one LLM API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

## Sandbox Output File Previews

Files produced by sandbox code execution (or user uploads) are rendered inline in the conversation:

| Category | Content Types | Rendering |
|----------|--------------|-----------|
| Images | `image/png`, `image/jpeg`, `image/gif`, `image/svg+xml`, `image/webp` | Thumbnail with click-to-expand lightbox |
| HTML | `text/html` | Sandboxed `<iframe>` with expand to fullscreen |
| PDF | `application/pdf` | Browser PDF viewer iframe with expand |
| Video | `video/mp4`, `video/webm` | `<video>` with native controls |
| Audio | `audio/mpeg`, `audio/wav`, `audio/ogg` | `<audio>` with native controls |
| CSV | `text/csv` | Sortable table with expand to fullscreen |
| Text/Code | `text/plain`, `application/json`, `application/xml` | Syntax-highlighted code block |
| Other | Everything else | Download button |

Presigned URLs are fetched lazily via IntersectionObserver and cached for 45 minutes.

## Documentation

### Operations
- [Deployment Guide](docs/DEPLOYMENT.md) — Docker Compose, production, enterprise
- [Operations Runbook](docs/OPERATIONS.md) — Health checks, monitoring, incident response
- [Observability Guide](docs/OBSERVABILITY.md) — Grafana dashboards, traces, logs, alerting
- [Contributing](docs/CONTRIBUTING.md) — Dev setup, code style, PR workflow

### Architecture
- [System Plan](docs/REFINED_SYSTEM_PLAN.md) — Current architecture and decisions
- [API Design](docs/API_DESIGN.md) — All 234 endpoints, conventions, error handling
- [Database Schema](docs/DATABASE_SCHEMA.md) — Full DDL for all 75 tables
- [Security](docs/SECURITY.md) — Threat model, trust boundaries, security controls
- [Domain Model](docs/DOMAIN_MODEL.md) — Entity relationships and constraints

### Planning
- [User Stories](docs/USER_STORIES.md) — Feature breakdown
- [Roadmap](docs/ROADMAP.md) — Phases and completion status
- [Technology Research](docs/TECHNOLOGY_RESEARCH.md) — Tech stack rationale
- [Competitive Analysis](docs/COMPETITIVE_ANALYSIS.md) — vs Open WebUI, LibreChat

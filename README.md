# NOVA

> The self-hosted AI platform built for teams.

NOVA is a self-hosted-first, multi-tenant AI chat platform with custom agents, knowledge collections, and sandboxed code execution.

**License:** FSL-1.1-Apache-2.0

## Architecture

Bun workspace monorepo with 7 packages:

- **@nova/shared** — Drizzle schemas (65 tables), types, constants, utils, skills
- **@nova/api** — Hono + Bun API server (REST, SSE, WebSocket)
- **@nova/web** — React 19 + Vite + Tailwind v4 + TanStack Router + TanStack Query + Zustand
- **@nova/worker-shared** — Shared worker infrastructure (db, redis, litellm, stream-publisher, qdrant, minio, sandbox, tools)
- **@nova/worker-agent** — Temporal agent workflows (task queue: `nova-agent`). Chat execution, tool use, DAG orchestration
- **@nova/worker-ingestion** — Temporal ingestion workflows (task queue: `nova-ingestion`). Document/file/message embedding pipelines
- **@nova/worker-background** — Temporal background workflows (task queue: `nova-background`). Research, summaries, cleanup, scheduling

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
- **Workers** (agent, ingestion, background) → connect to Temporal at localhost:7233

### Manual setup (without Make)

```bash
docker compose up -d postgres redis minio litellm temporal temporal-db temporal-ui qdrant searxng
bun run db:migrate
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
| API | 3000 | Backend API |
| PostgreSQL | 5432 | Database (pg_trgm) |
| Redis | 6379 | Cache, pub/sub, rate limiting |
| MinIO | 9000/9001 | S3-compatible file storage |
| LiteLLM | 4000 | LLM proxy gateway |
| Qdrant | 6333/6334 | Vector search engine |
| Temporal | 7233 | Workflow orchestration |
| Temporal UI | 8233 | Temporal dashboard |
| SearxNG | 8888 | Web search |

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

- [System Plan](docs/REFINED_SYSTEM_PLAN.md)
- [API Design](docs/API_DESIGN.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Security](docs/SECURITY.md)
- [Domain Model](docs/DOMAIN_MODEL.md)
- [User Stories](docs/USER_STORIES.md)
- [Roadmap](docs/ROADMAP.md)
- [Audit Report](docs/AUDIT_REPORT.md)
- [Competitive Analysis](docs/COMPETITIVE_ANALYSIS.md)
- [Technology Research](docs/TECHNOLOGY_RESEARCH.md)

# NOVA

> The self-hosted AI platform built for teams.

NOVA is a self-hosted-first, multi-tenant AI chat platform with custom agents, knowledge collections, and sandboxed code execution.

**License:** FSL-1.1-Apache-2.0

## Architecture

- **@nova/api** — Hono + Bun API server (REST, SSE, WebSocket)
- **@nova/web** — React 19 + Vite + Tailwind v4 + TanStack Router
- **@nova/worker** — Temporal workflows (runs on Node.js)
- **@nova/shared** — Drizzle schemas, types, constants, utils

## Prerequisites

- [Bun](https://bun.sh/) >= 1.x
- [Docker](https://www.docker.com/) + Docker Compose
- Node.js 22+ (for worker package only)

## Quick Start

### 1. Start infrastructure

```bash
cp .env.example .env
docker compose up -d postgres redis minio temporal temporal-db temporal-ui litellm
```

### 2. Install dependencies

```bash
bun install
```

### 3. Run database migrations

```bash
bun run db:push
```

### 4. Start development servers

```bash
bun run dev
```

This starts all packages concurrently:
- **API** → http://localhost:3000
- **Web** → http://localhost:5173
- **Worker** → connects to Temporal at localhost:7233

### Individual packages

```bash
bun run dev:api     # API only
bun run dev:web     # Web only
bun run dev:worker  # Worker only
```

## Build

```bash
bun run build       # Build all packages
bun run typecheck   # TypeScript check all packages
bun test            # Run all tests
```

## Docker

Build all service images:

```bash
docker compose build api worker web
```

Run the full stack:

```bash
docker compose up -d
```

| Service | Port | Description |
|---------|------|-------------|
| Web | 5173 | Frontend (nginx) |
| API | 3000 | Backend API |
| PostgreSQL | 5432 | Database (pgvector + pg_trgm) |
| Redis | 6379 | Cache, pub/sub, rate limiting |
| MinIO | 9000/9001 | S3-compatible file storage |
| LiteLLM | 4000 | LLM proxy gateway |
| Temporal | 7233 | Workflow orchestration |
| Temporal UI | 8233 | Temporal dashboard |

## Environment Variables

See [`.env.example`](.env.example) for all available configuration options.

Required for production:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `BETTER_AUTH_SECRET` — Auth secret (min 32 chars)
- `BETTER_AUTH_URL` — API base URL
- At least one LLM API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

## Documentation

- [System Plan](docs/REFINED_SYSTEM_PLAN.md)
- [API Design](docs/API_DESIGN.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Security](docs/SECURITY.md)
- [Domain Model](docs/DOMAIN_MODEL.md)
- [User Stories](docs/USER_STORIES.md)
- [Roadmap](docs/ROADMAP.md)

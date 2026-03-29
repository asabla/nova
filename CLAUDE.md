# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NOVA — self-hosted-first AI chat platform (multi-tenant SaaS). License: FSL-1.1-Apache-2.0.

## Monorepo Structure

Bun workspace monorepo with 7 packages:

- **@nova/shared** — Drizzle schemas (75 tables), types, constants, utils, skills. Exports: `./schema`, `./schemas`, `./types`, `./constants`, `./utils`, `./content`, `./skills`
- **@nova/api** — Hono REST API on Bun runtime. Routes in `src/routes/`, services in `src/services/`, middleware in `src/middleware/`
- **@nova/web** — React 19 + Vite + TanStack Router + TanStack Query + Zustand + Tailwind v4. Path alias `@/*` → `src/*`
- **@nova/worker-shared** — Shared worker infrastructure (db, redis, model-client, stream-publisher, qdrant, minio, sandbox, tools). Conditional exports like `@nova/worker-shared/db`
- **@nova/worker-agent** — Temporal agent workflows on **Node.js** (task queue: `nova-agent`). Chat execution, tool use, DAG orchestration
- **@nova/worker-ingestion** — Temporal ingestion workflows on **Node.js** (task queue: `nova-ingestion`). Document/file/message embedding pipelines
- **@nova/worker-background** — Temporal background workflows on **Node.js** (task queue: `nova-background`). Research, summaries, cleanup, scheduling

## Commands

```bash
# Development
bun run dev              # All packages
bun run dev:api          # API only (localhost:3000)
bun run dev:web          # Web only (localhost:5173)
bun run dev:workers      # All 3 workers
bun run dev:worker:agent      # Agent worker only
bun run dev:worker:ingestion  # Ingestion worker only
bun run dev:worker:background # Background worker only

# Build & typecheck
bun run build            # Build all packages
bun run typecheck        # tsc --noEmit across all packages

# Database (Drizzle)
bun run db:generate      # Generate migration files
bun run db:migrate       # Apply migrations
bun run db:push          # Sync schema directly (dev shortcut)
bun run db:studio        # Drizzle Studio UI
bun run --filter @nova/api db:seed  # Seed database

# Testing
bun test                           # All tests (Bun unit + Playwright e2e)
bun test packages/api/tests/       # Tests in one package
bun test packages/api/tests/lib/stream-relay.test.ts  # Single test file

# Storybook
bun run storybook        # Dev server on port 6006

# Docker
docker compose build api web worker-agent worker-ingestion worker-background
docker compose up -d api web worker-agent worker-ingestion worker-background
```

**Unit tests** use `bun:test` (`describe`, `it`, `expect`). Test files live in `packages/*/tests/`.

**E2E tests** use Playwright (config at root `playwright.config.ts`), files in `packages/web/tests/e2e/*.e2e.test.ts`.

## Architecture

### API middleware chain (order matters)

Error handler → Security headers → CORS → Request ID → Logger → **Public routes** (auth, health, webhooks, SSO OAuth) → Rate limit → **Auth** → Org scope → Role resolver → MFA guard → Content filter → Budget guard (LLM routes)

### Key patterns

- **Services**: Named exports of async functions, no default exports. Located in `packages/api/src/services/`
- **Centralized agent marketplace**: A "system org" (`isSystemOrg: true` on `organisations` table) owns platform-curated agents. All orgs see these in their marketplace alongside org-local agents. Users "install" platform agents by cloning into their org via `POST /api/agents/marketplace/:id/install`. The `source` field (`"platform"` vs `"org"`) distinguishes them in API responses and the marketplace UI.
- **Errors**: Use `AppError` from `@nova/shared/utils` — `AppError.notFound()`, `AppError.unauthorized()`, `AppError.badRequest()`
- **Shared imports**: `import { conversations } from "@nova/shared/schema"`, `import type { User } from "@nova/shared/types"`
- **Temporal workflows**: Orchestrate via `proxyActivities()`. Activities are side-effect functions (LLM calls, DB writes). Each worker registers its own workflows/activities. The unified `agentWorkflow` (`packages/worker-agent/src/workflows/agent.ts`) handles both chat and execution modes. It auto-summarizes conversation context when history exceeds ~25k tokens (100k chars) to stay within model limits — the middle portion is compressed to a "Previously: ..." summary while preserving system messages, the first user message, and the last 4 messages. Workflows are dispatched to specific task queues via `TASK_QUEUES` constants from `@nova/shared/constants`.
- **Auth**: Better Auth ^1.2.7. Session restored in `_auth.tsx` `beforeLoad` via `authClient.getSession()`. Cookie config uses `advanced.cookiePrefix` / `advanced.cookies.session_token.name` (NOT `session.cookieName` — silently ignored)
- **Frontend state**: Zustand for client state (`auth.store.ts`, `ui.store.ts`, `ws.store.ts`), TanStack Query for server state
- **Route generation**: TanStack Router file-based routing, auto-generates `routeTree.gen.ts`
- **Attachment previews**: `AttachmentPreview` component (`components/common/AttachmentPreview.tsx`) renders inline previews for images, HTML, PDF, video, audio, CSV, and text/code files. Uses `usePresignedUrl` hook with IntersectionObserver for lazy loading. Falls back to download button for unsupported types or on error.
- **Agent skills**: 16 skills defined in `packages/shared/src/skills.ts` (xlsx, pdf, docx, pptx, algorithmic-art, brand-guidelines, canvas-design, claude-api, doc-coauthoring, excalidraw, frontend-design, internal-comms, mcp-builder, theme-factory, web-artifacts-builder, webapp-testing). Skills are triggered by file MIME types or keyword matching in user messages. Full SKILL.md instructions, scripts, and docs are baked into the sandbox Docker image at `/sandbox/skills/{name}/`. Compact instruction summaries are injected into the agent prompt. Skill content source: `packages/shared/skills/`.
- **Widgets**: 22 dynamic widgets rendered inline in chat (weather, chart, map, poll, timer, countdown, kanban, etc.). Registry at `packages/web/src/components/chat/widgets/registry.ts`. `DynamicWidget` component supports iframe embeds, auto-refresh, and custom parameters.
- **Stream relay**: SSE streaming via Redis pub/sub. Events are dual-published to both pub/sub channels and Redis lists (`stream-events:{channelId}`) for replay on reconnection. Stream relay logic in `packages/api/src/lib/stream-relay.ts`. Event types include `token`, `content_clear`, `tool_status`, `retry`, agent flow events (`tier.assessed`, `plan.generated`, `plan.node.status`), `done`, `error`.

### Infrastructure services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Main database (pg_trgm) |
| Redis | 6379 | Cache, pub/sub, rate limiting |
| MinIO | 9000/9001 | S3-compatible file storage |
| *(removed)* | *(4000)* | LLM calls go directly to providers (OpenAI, Anthropic, etc.) |
| Qdrant | 6333/6334 | Vector search engine |
| Temporal | 7233 | Workflow orchestration (separate DB) |
| Temporal UI | 8233 | Workflow dashboard |
| SearxNG | 8888 | Web search |

## Typecheck Architecture

`bun run typecheck` first builds `@nova/shared` declarations (`tsc -b`), then typechecks all packages in parallel. Shared uses **conditional exports** — `"types"` points to `dist/*.d.ts` (for tsc), `"default"` points to `src/*.ts` (for Bun/Vite runtime). Consumer tsconfigs use `incremental` for caching.

### Known OOM sources and mitigations

The API package is extremely type-heavy. Three things caused tsc to OOM at 16GB+:

1. **`zValidator` from `@hono/zod-validator`** (root cause, ~95% of the problem). Each of the 110 `zValidator()` calls creates exponentially complex Hono middleware chain types. Use `--generateTrace` to diagnose: `NODE_OPTIONS="--max-old-space-size=12288" npx tsc --noEmit --generateTrace /tmp/tsc-trace -p packages/api/tsconfig.json`. The fix: `packages/api/src/lib/validator.ts` re-exports `zValidator` with simplified types. **All route files must import from `../lib/validator`, never from `@hono/zod-validator` directly.**

2. **`drizzle(client, { schema })` in `db.ts`**. Passing 62 table schemas forces tsc to compute a massive relational type. Since the API only uses the query builder (`.select()`, `.insert()`, etc.) and never `db.query.*`, the schema is omitted: `drizzle(client)`.

3. **`betterAuth()` return type**. The inferred return type pulls in 136+ better-auth and 251 kysely type files. The result is cast to a minimal interface in `auth.ts` covering only `auth.handler()` and `auth.api.getSession()`.

The API's typecheck script uses `NODE_OPTIONS='--max-old-space-size=6144'` (6GB heap). If OOM returns, use `--generateTrace` to find the new hotspot — it's almost always a deeply-inferred generic type that needs an explicit annotation or cast.

## Gotchas

- **Worker runtime**: Temporal requires Node.js — all 3 worker packages use `tsx` (dev) and compiled JS (Docker), not Bun. Shared infra lives in `@nova/worker-shared`
- **Hot reload limitation**: `bun --hot` doesn't reliably reload transitive dependency changes — rebuild Docker container
- **Env propagation**: `bun run --filter` doesn't propagate root `.env` — use `docker compose up` or set vars manually
- **DB config**: Drizzle config is at `packages/api/drizzle.config.ts`, schemas are in `packages/shared/src/schemas/`
- **No lint script**: `bun run lint` is defined but individual packages don't have lint scripts yet
- **Makefile**: `make setup`, `make dev`, `make deploy`, `make infra`, etc. — run `make help` for all targets. Generally equivalent to the `bun run` commands but more convenient for common workflows
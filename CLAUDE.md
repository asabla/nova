# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NOVA — self-hosted-first AI chat platform (multi-tenant SaaS). License: FSL-1.1-Apache-2.0.

## Monorepo Structure

Bun workspace monorepo with 4 packages:

- **@nova/shared** — Drizzle schemas (62 tables), types, constants, utils. Exports: `./schema`, `./schemas`, `./types`, `./constants`, `./utils`
- **@nova/api** — Hono REST API on Bun runtime. Routes in `src/routes/`, services in `src/services/`, middleware in `src/middleware/`
- **@nova/web** — React 19 + Vite + TanStack Router + TanStack Query + Zustand + Tailwind v4. Path alias `@/*` → `src/*`
- **@nova/worker** — Temporal workflows on **Node.js** (not Bun — Temporal requires it). Uses `tsx` for dev

## Commands

```bash
# Development
bun run dev              # All packages
bun run dev:api          # API only (localhost:3000)
bun run dev:web          # Web only (localhost:5173)
bun run dev:worker       # Worker only

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
docker compose build api web
docker compose up -d api web
```

**Unit tests** use `bun:test` (`describe`, `it`, `expect`). Test files live in `packages/*/tests/`.

**E2E tests** use Playwright (config at root `playwright.config.ts`), files in `packages/web/tests/e2e/*.e2e.test.ts`.

## Architecture

### API middleware chain (order matters)

Error handler → Security headers → CORS → Request ID → Logger → **Public routes** (auth, health, webhooks) → Rate limit → **Auth** → Org scope → MFA guard → Content filter → Budget guard (LLM routes)

### Key patterns

- **Services**: Named exports of async functions, no default exports. Located in `packages/api/src/services/`
- **Errors**: Use `AppError` from `@nova/shared/utils` — `AppError.notFound()`, `AppError.unauthorized()`, `AppError.badRequest()`
- **Shared imports**: `import { conversations } from "@nova/shared/schema"`, `import type { User } from "@nova/shared/types"`
- **Temporal workflows**: Orchestrate via `proxyActivities()`. Activities are side-effect functions (LLM calls, DB writes). Worker registers both in `src/index.ts`. The unified `agentWorkflow` (`packages/worker/src/workflows/agent.ts`) handles both chat and execution modes. It auto-summarizes conversation context when history exceeds ~25k tokens (100k chars) to stay within model limits — the middle portion is compressed to a "Previously: ..." summary while preserving system messages, the first user message, and the last 4 messages.
- **Auth**: Better Auth v1.5.4. Session restored in `_auth.tsx` `beforeLoad` via `authClient.getSession()`. Cookie config uses `advanced.cookiePrefix` / `advanced.cookies.session_token.name` (NOT `session.cookieName` — silently ignored)
- **Frontend state**: Zustand for client state (auth, UI), TanStack Query for server state
- **Route generation**: TanStack Router file-based routing, auto-generates `routeTree.gen.ts`
- **Attachment previews**: `AttachmentPreview` component (`components/common/AttachmentPreview.tsx`) renders inline previews for images, HTML, PDF, video, audio, CSV, and text/code files. Uses `usePresignedUrl` hook with IntersectionObserver for lazy loading. Falls back to download button for unsupported types or on error.
- **Agent skills**: 15 skills defined in `packages/shared/src/skills.ts` (xlsx, pdf, docx, pptx, algorithmic-art, brand-guidelines, canvas-design, claude-api, doc-coauthoring, frontend-design, internal-comms, mcp-builder, theme-factory, web-artifacts-builder, webapp-testing). Skills are triggered by file MIME types or keyword matching in user messages. Full SKILL.md instructions, scripts, and docs are baked into the sandbox Docker image at `/sandbox/skills/{name}/`. Compact instruction summaries are injected into the agent prompt. Skill content source: `packages/shared/skills/`.

### Infrastructure services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Main database (pgvector + pg_trgm) |
| Redis | 6379 | Cache, pub/sub, rate limiting |
| MinIO | 9000/9001 | S3-compatible file storage |
| LiteLLM | 4000 | LLM proxy (needs OPENAI_API_KEY or ANTHROPIC_API_KEY) |
| Temporal | 7233 | Workflow orchestration (separate DB) |
| Temporal UI | 8233 | Workflow dashboard |
| SearxNG | 8888 | Web search |

## Typecheck Architecture

`bun run typecheck` first builds `@nova/shared` declarations (`tsc -b`), then typechecks all 4 packages in parallel. Shared uses **conditional exports** — `"types"` points to `dist/*.d.ts` (for tsc), `"default"` points to `src/*.ts` (for Bun/Vite runtime). Consumer tsconfigs use `incremental` for caching.

### Known OOM sources and mitigations

The API package is extremely type-heavy. Three things caused tsc to OOM at 16GB+:

1. **`zValidator` from `@hono/zod-validator`** (root cause, ~95% of the problem). Each of the 110 `zValidator()` calls creates exponentially complex Hono middleware chain types. Use `--generateTrace` to diagnose: `NODE_OPTIONS="--max-old-space-size=12288" npx tsc --noEmit --generateTrace /tmp/tsc-trace -p packages/api/tsconfig.json`. The fix: `packages/api/src/lib/validator.ts` re-exports `zValidator` with simplified types. **All route files must import from `../lib/validator`, never from `@hono/zod-validator` directly.**

2. **`drizzle(client, { schema })` in `db.ts`**. Passing 62 table schemas forces tsc to compute a massive relational type. Since the API only uses the query builder (`.select()`, `.insert()`, etc.) and never `db.query.*`, the schema is omitted: `drizzle(client)`.

3. **`betterAuth()` return type**. The inferred return type pulls in 136+ better-auth and 251 kysely type files. The result is cast to a minimal interface in `auth.ts` covering only `auth.handler()` and `auth.api.getSession()`.

The API's typecheck script uses `NODE_OPTIONS='--max-old-space-size=6144'` (6GB heap). If OOM returns, use `--generateTrace` to find the new hotspot — it's almost always a deeply-inferred generic type that needs an explicit annotation or cast.

## Gotchas

- **Worker runtime**: Temporal requires Node.js — the worker package uses `tsx` (dev) and compiled JS (Docker), not Bun
- **Hot reload limitation**: `bun --hot` doesn't reliably reload transitive dependency changes — rebuild Docker container
- **Env propagation**: `bun run --filter` doesn't propagate root `.env` — use `docker compose up` or set vars manually
- **DB config**: Drizzle config is at `packages/api/drizzle.config.ts`, schemas are in `packages/shared/src/schemas/`
- **No lint script**: `bun run lint` is defined but individual packages don't have lint scripts yet

# Contributing to Nova

Nova is a self-hosted AI chat platform built as a Bun monorepo. This guide will get you productive quickly.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Bun](https://bun.sh) | >= 1.x | Primary runtime and package manager |
| [Node.js](https://nodejs.org) | >= 22 | Required for Temporal workers only |
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | Latest | Infrastructure services |
| [GNU Make](https://www.gnu.org/software/make/) | Any | Task runner shortcuts |

## Getting Started

```bash
cp .env.example .env   # Configure environment variables
bun install            # Install all workspace dependencies
make setup             # Provision infrastructure (Postgres, Redis, RustFS, Qdrant, Temporal, etc.)
make dev               # Start everything
```

After startup:

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Web | http://localhost:5173 |
| Admin | http://localhost:5174 |
| Storybook | http://localhost:6006 (run `bun run storybook`) |
| Temporal UI | http://localhost:8233 |

You can also start services individually:

```bash
bun run dev:api              # API only
bun run dev:web              # Web only
bun run dev:workers          # All 3 Temporal workers
bun run dev:worker:agent     # Agent worker only
```

## Project Structure

```
packages/
  shared/             Drizzle schemas (75 tables), types, constants, skills
  api/                Hono REST API (runs on Bun)
  web/                React 19 + Vite + TanStack Router + TanStack Query
  admin/              Separate admin portal (React 19 + Vite, fully isolated)
  worker-shared/      Shared worker infrastructure (db, redis, model-client, etc.)
  worker-agent/       Temporal workflows — chat execution, tool use, DAG orchestration
  worker-ingestion/   Temporal workflows — document/file/message embedding
  worker-background/  Temporal workflows — research, summaries, cleanup, scheduling
```

**Important runtime distinction:** The API runs on Bun. All three workers run on Node.js (Temporal requires it). They use `tsx` in development and compiled JS in Docker.

## Coding Conventions

### Services

Named exports of async functions. No default exports.

```ts
// Good
export async function getConversation(id: string) { ... }

// Bad
export default async function getConversation(id: string) { ... }
```

### Error Handling

Use `AppError` from `@nova/shared/utils`:

```ts
import { AppError } from "@nova/shared/utils";

throw AppError.notFound("Conversation not found");
throw AppError.unauthorized();
throw AppError.badRequest("Invalid input");
```

### Database

Use Drizzle ORM exclusively. No raw SQL (except admin auth).

```ts
import { conversations } from "@nova/shared/schema";
```

### API Route Validation

Import the validator from the local wrapper, **never** from `@hono/zod-validator` directly. The wrapper prevents TypeScript OOM during typechecking.

```ts
// Correct
import { zValidator } from "../lib/validator";

// Wrong — causes tsc OOM
import { zValidator } from "@hono/zod-validator";
```

### Frontend State

- **Client state:** Zustand stores (`auth.store.ts`, `ui.store.ts`, `ws.store.ts`)
- **Server state:** TanStack Query

### Shared Package Imports

```ts
import { conversations } from "@nova/shared/schema";
import type { User } from "@nova/shared/types";
import { AppError } from "@nova/shared/utils";
```

The shared package uses conditional exports: `"types"` resolves to `dist/*.d.ts` (for tsc), `"default"` resolves to `src/*.ts` (for Bun/Vite runtime).

## Quality Checks

Run these before submitting a PR:

```bash
bun run typecheck          # TypeScript check across all packages
bun test                   # Unit tests (bun:test)
bunx playwright test       # E2E tests
```

For targeted testing:

```bash
bun test packages/api/tests/                          # One package
bun test packages/api/tests/lib/stream-relay.test.ts  # Single file
```

Unit tests use `bun:test` (`describe`, `it`, `expect`). Test files live in `packages/*/tests/`.

E2E tests use Playwright. Config is at the repo root (`playwright.config.ts`), test files are in `packages/web/tests/e2e/*.e2e.test.ts`.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add conversation search
fix: prevent duplicate messages on reconnect
fix(api): handle missing org membership gracefully
feat(admin): render template icons from data
```

Common prefixes: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. Use a scope in parentheses when the change is clearly scoped to one package.

## Pull Request Process

1. **Branch from `main`** — use a descriptive branch name (`feat/conversation-search`, `fix/duplicate-messages`).
2. **Keep PRs focused** — one feature or fix per PR.
3. **Run quality checks** — `bun run typecheck && bun test` must pass.
4. **Write a clear description** — summarize what changed and why. Include a test plan.
5. **Push and open a PR against `main`**.

## Common Gotchas

- **`bun --hot` limitation:** Transitive dependency changes may not reload. Restart the process or rebuild the Docker container.
- **`bun run --filter` and env vars:** The filter flag does not propagate the root `.env`. Use `docker compose up` or set variables manually.
- **Drizzle config** lives at `packages/api/drizzle.config.ts`; schemas are in `packages/shared/src/schemas/`.
- **No lint script yet:** `bun run lint` is defined but individual packages don't have lint scripts.
- **Typecheck OOM:** If `bun run typecheck` runs out of memory, the cause is almost always a deeply-inferred generic type. Use `--generateTrace` to diagnose. See `CLAUDE.md` for details.

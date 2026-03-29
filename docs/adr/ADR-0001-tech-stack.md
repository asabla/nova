# ADR-0001: Technology Stack

- **Status:** Accepted (updated 2026-03-29 to reflect pgvector→Qdrant migration and LiteLLM removal)
- **Date:** 2026-03-06 (original), 2026-03-29 (updated)
- **Deciders:** NOVA Core Team

## Context

NOVA is a self-hosted-first AI chat platform with multi-tenancy designed in from day one. The platform requires real-time streaming (SSE/WebSocket), durable workflow orchestration, file processing, RAG-based knowledge retrieval, sandboxed code execution, and a modern web frontend. The tech stack must support self-hosted and eventual SaaS deployment without architectural changes.

## Decisions

### Runtime: Bun

**Decision:** Bun is the primary JavaScript/TypeScript runtime for the API server and frontend tooling.

**Rationale:** Bun provides significantly faster startup, native TypeScript execution, built-in test runner, and fast package management. Its native HTTP server and WebSocket support are well-suited for a real-time chat platform.

**Trade-offs:**
- Bun's Node.js compatibility layer has gaps, particularly with native modules and `worker_threads`
- Memory leak reports exist for long-lived connections in production (Bun issues #16503, #17723, #25948)
- SSE streams require explicit `idleTimeout: 0` to prevent silent disconnection (Bun issue #27479)
- The `packages/worker-*` services MUST run on Node.js due to Temporal SDK requirements (see below)

**Mitigations:**
- Hono framework allows zero-code-change migration to Node.js if Bun proves unstable
- SSE/WebSocket services can be isolated into separate processes
- Memory monitoring with alerts is mandatory in production

### API Framework: Hono (see ADR-0002 for detailed evaluation)

**Decision:** Hono is the HTTP/WebSocket framework for the API server.

### Database: PostgreSQL 16 + pg_trgm

**Decision:** PostgreSQL 16 as the primary relational database with pg_trgm for full-text search.

**Rationale:**
- pg_trgm enables trigram-based fuzzy text search without external search infrastructure
- PostgreSQL 16 brings performance improvements for concurrent workloads

> **UPDATE (2026-03-29):** pgvector was originally planned but replaced by Qdrant as a dedicated vector database. This provides better scaling characteristics and separates vector workloads from relational queries.

### Vector Search: Qdrant

**Decision:** Qdrant as the dedicated vector database for all embedding and similarity search (ports 6333/6334).

**Rationale:**
- Purpose-built for vector search with better performance characteristics than pgvector at scale
- Separates vector workloads from relational queries, reducing PostgreSQL memory pressure
- Rich filtering capabilities for multi-tenant vector isolation via org_id payloads
- gRPC and REST APIs, native collection partitioning

**Trade-offs:**
- Additional infrastructure service to operate
- Data split across two systems (relational in PostgreSQL, vectors in Qdrant)

### ORM: Drizzle ORM + drizzle-kit

**Decision:** Drizzle ORM for database access with drizzle-kit for schema migrations.

**Rationale:**
- Thin SQL-like abstraction that doesn't hide the database
- Native pgvector column support via `vector()` type
- drizzle-zod generates Zod schemas from table definitions for input validation
- Works with Bun without compatibility issues
- Strong TypeScript inference for query results

**Trade-offs:**
- No automatic migration rollbacks (forward-only migrations)
- Fewer community plugins than Prisma
- Generated migrations must be manually reviewed

### Cache / Message Broker: Redis 7.2+

**Decision:** Redis 7 for session storage, pub/sub, rate limiting, and job deduplication.

**Rationale:**
- Session store for Better Auth
- Pub/sub for SSE fan-out across multiple API pods (horizontal scaling)
- Token bucket rate limiting with atomic Lua scripts
- Lightweight, well-understood, single-process deployment

**Trade-offs:**
- Single point of failure unless deployed as Redis Sentinel or Cluster
- Memory-bound: large pub/sub workloads need monitoring

### Object Storage: MinIO (S3-compatible)

**Decision:** MinIO for all file storage (uploads, artifacts, exports).

**Rationale:**
- S3-compatible API means zero code changes to switch to AWS S3, GCS, or other providers
- Self-hosted: no cloud dependency for air-gapped deployments
- Supports presigned URLs for direct client uploads
- Console UI for debugging

**Trade-offs:**
- Production MinIO with erasure coding needs minimum 4 drives
- Single-node MinIO is acceptable for dev/staging but not production durability

### ~~AI Model Gateway: LiteLLM~~ (Removed)

> **UPDATE (2026-03-29):** LiteLLM has been removed from the architecture. LLM calls now go directly to providers (OpenAI, Anthropic, etc.) via a provider registry stored in the database. Model providers and their API keys are configured per-org through the admin UI. This eliminates the ~200-500MB RAM overhead and removes a Python dependency from the stack.

**Original decision:** LiteLLM (Docker) as the universal model gateway.

**Why removed:**
- Direct provider calls reduce latency and operational complexity
- Provider registry in DB gives per-org configuration without a separate service
- Cost tracking is handled at the application layer via usage_stats table
- Model fallback is implemented in the agent workflow layer

### Workflow Engine: Temporal

**Decision:** Temporal for all durable async workflows: agent loops, deep research, file ingestion, scheduled runs, notifications.

**Rationale:**
- Best-in-class durability guarantees for long-running workflows
- Native signal/query support maps perfectly to human-in-the-loop agent approval
- Workflows can wait hours/days for approval without resource consumption
- Built-in retry, timeout, and compensation logic
- Temporal UI provides workflow replay and debugging
- Proven at scale (used by Netflix, Uber, Stripe, Snap)

**Trade-offs:**
- **CRITICAL: Temporal TypeScript Worker requires Node.js** -- Bun is NOT supported for worker execution due to dependencies on `worker_threads`, `vm` module, and Node-API native modules
- Adds infrastructure complexity: Temporal server needs its own PostgreSQL database
- ~2-4GB additional RAM for the Temporal server in production
- Significant learning curve (event sourcing, deterministic constraints)

**Consequences:**
- `packages/worker-agent`, `packages/worker-ingestion`, `packages/worker-background` MUST use Node.js runtime, not Bun
- `packages/api` uses `@temporalio/client` only (lighter, likely Bun-compatible for gRPC calls)
- Validate `@temporalio/client` under Bun early in Phase 1
- Docker Compose includes `temporal-server` and `temporal-ui` services

### Authentication: Better Auth

**Decision:** Better Auth for authentication with local credentials, Azure Entra ID OIDC, and magic-link adapters.

**Rationale:**
- TypeScript-native with first-class Hono integration
- Built-in multi-tenancy with organizations, teams, roles, invitations, and member management
- Supports email/password, OAuth (Azure Entra ID, Google, GitHub), TOTP 2FA, magic links
- Drizzle ORM adapter for PostgreSQL
- Session management with configurable cookie settings
- Works with Bun runtime

**Trade-offs:**
- Newer library with smaller community than Auth.js/NextAuth
- Less enterprise battle-testing than WorkOS or Clerk
- Self-hosted means owning the security surface

### Frontend: Vite + React 19 + Tailwind CSS v4

**Decision:** Vite as the build tool, React 19 for the UI library, Tailwind CSS v4 for styling.

**Rationale:**
- Vite provides fast HMR and optimized production builds
- React 19 with concurrent features, server components groundwork
- Tailwind CSS v4 with `@tailwindcss/vite` plugin (no PostCSS config needed)
- TanStack Router for type-safe file-based routing (see evaluation below)
- Zustand for client-side state, TanStack Query for server state

**Router choice: TanStack Router over React Router v7:**
- Superior TypeScript inference for route params and search params
- Type-safe navigation across the entire app
- Better integration with TanStack Query for data loading
- React Router v7's type safety only works in "framework mode" (not SPA)

### Observability: OpenTelemetry + LangFuse + Prometheus + Grafana

**Decision:** OpenTelemetry as the instrumentation standard, LangFuse for LLM-specific tracing, Prometheus + Grafana for infrastructure metrics.

**Rationale:**
- LangFuse v3 is OTEL-native: traces flow through standard OTEL pipeline
- LiteLLM has native LangFuse integration via OTEL
- Prometheus/Grafana are the standard for infrastructure monitoring
- Single OTEL collector receives traces from API, worker, and LiteLLM

### Code Sandbox: Phased approach (nsjail -> gVisor -> Firecracker)

**Decision:** Abstract sandbox interface with three backend implementations deployed in phases.

**Rationale:**
- Firecracker provides VM-level isolation but requires KVM access and significant engineering
- nsjail provides namespace/cgroup isolation adequate for authenticated users in MVP
- Abstract `SandboxBackend` interface allows swapping implementations via configuration

**Phase plan:**
- Phase 1-3 (MVP through Agents): nsjail (no KVM needed, deploys anywhere)
- Phase 3 hardening: gVisor option (user-space kernel, no KVM)
- Phase 4 (Production multi-tenant): Firecracker microVMs (VM-level isolation)

### Monorepo: Bun Workspaces

**Decision:** Bun workspaces for monorepo management with packages under `packages/`.

**Rationale:**
- Native Bun support, fast dependency installation
- Simpler than Turborepo/Nx for our scale
- Works with the mixed Bun/Node.js runtime strategy

**Consequences:**
- `packages/worker-*` need explicit Node.js configuration despite being in a Bun workspace
- TypeScript project references ensure proper build order

### License: FSL-1.1-Apache-2.0

**Decision:** Functional Source License 1.1 with Apache 2.0 future license.

**Rationale:**
- Blocks commercial exploitation by competitors (no SaaS forks)
- Converts to Apache 2.0 after 2 years (contributor-friendly)
- Used by Sentry, GitButler, PowerSync (proven model)
- All source files include `SPDX-License-Identifier: FSL-1.1-Apache-2.0`

## Consequences

The overall stack prioritizes:
1. **Self-hosted simplicity** — Docker Compose gets the full platform running locally
2. **TypeScript end-to-end** — except Temporal server (Go)
3. **Portability** — Hono's multi-runtime support provides an escape hatch from Bun
4. **Pragmatism** — nsjail before Firecracker, direct provider calls before gateway proxy
5. **Mixed runtime** — Bun for API/web, Node.js for Temporal workers

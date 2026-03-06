# NOVA -- Refined System Plan

> Version: 2.0 (Refined with comprehensive technology research)
> Date: 2026-03-06
> Status: Ready for implementation planning

---

## Executive Summary

NOVA is a self-hosted-first AI chat platform with multi-tenancy, custom agents, knowledge collections, and sandboxed code execution.

**Positioning:** "The self-hosted AI platform built for teams."

**Key differentiators** (see `docs/COMPETITIVE_ANALYSIS.md` for full analysis):
- **vs Open WebUI** (124K stars): NOVA adds true multi-tenancy, real-time collaboration, durable agent workflows, and enterprise compliance. Open WebUI is single-user focused with no org isolation.
- **vs LibreChat** (33K stars): NOVA adds PostgreSQL (no 16MB MongoDB limits), RAG/pgvector, durable workflows (Temporal), and multi-tenancy. LibreChat was acquired by ClickHouse in 2026 and may shift focus.
- **vs ChatGPT/Claude.ai**: NOVA is fully self-hosted with data sovereignty, custom agents, and no per-seat pricing. All data stays on your infrastructure.
- **License advantage**: FSL-1.1-Apache-2.0 with guaranteed Apache 2.0 conversion in 2 years -- no license rug-pull risk (unlike Open WebUI's controversial license change).

---

## Architecture Overview

```
                         +------------------+
                         |   Web Client     |
                         |  (React 19/Vite) |
                         +--------+---------+
                                  |
                         SSE / WS / REST
                                  |
                         +--------+---------+
                         |   API Server     |
                         |  (Bun + Hono)    |
                         +--+--+--+--+--+---+
                            |  |  |  |  |
          +-----------------+  |  |  |  +------------------+
          |         +----------+  |  +---------+           |
          |         |             |            |           |
   +------+------+  |  +----------+------+  +--+----------+--+
   | PostgreSQL  |  |  |    Redis       |  |    MinIO       |
   | (NOVA DB)   |  |  |  (pub/sub,    |  | (S3-compat     |
   | + pgvector  |  |  |   sessions,   |  |  file store)   |
   | + pg_trgm   |  |  |   rate lim)   |  +----------------+
   +------+------+  |  +-------+-------+
          |         |          |
          |    +----+----------+----+
          |    |  LiteLLM           |
          |    | (model gateway)    |
          |    | Python/FastAPI     |
          |    +---------+----------+
          |              |
          |    +---------+----------+    +------------------+
          |    | LangFuse           |    | Prometheus       |
          |    | (LLM tracing)      |    | + Grafana        |
          |    +--------------------+    +------------------+
          |
   +------+------+    +------------------+
   | PostgreSQL  |    |  Temporal Server |
   | (Temporal   |    |  (Go binary)     |
   |  internal)  +----+  port 7233       |
   +-------------+    +--------+---------+
                               |
                      +--------+---------+
                      | Worker (Node.js) |
                      | (Temporal        |
                      |  activities)     |
                      +--------+---------+
                               |
                      +--------+---------+
                      | Code Sandbox     |
                      | (nsjail/gVisor/  |
                      |  Firecracker)    |
                      +------------------+

  Note: Arrows represent primary data flow directions.
  API Server connects to ALL data stores directly.
  Worker connects to PostgreSQL (NOVA DB), MinIO, Redis, and LiteLLM.
  Two PostgreSQL instances: NOVA DB and Temporal internal DB.
  LiteLLM optionally uses NOVA PostgreSQL for spend tracking.
```

---

## Key Architectural Decisions (from Research)

### 1. Mixed Runtime Strategy

| Package | Runtime | Reason |
|---------|---------|--------|
| `packages/api` | Bun | Fast HTTP, native WS, TypeScript execution |
| `packages/web` | Bun (Vite) | Fast HMR, build tooling |
| `packages/worker` | **Node.js** | Temporal Worker SDK requires Node.js |
| `packages/shared` | Both | Pure TypeScript types and utilities |

This is the most significant finding from research. Temporal's Worker SDK depends on Node.js-specific APIs (`worker_threads`, `vm` module). The API server uses only `@temporalio/client` which is lighter.

### 2. Hono as API Framework

Selected over Elysia (too many critical bugs, Bun lock-in) and Fastify (Node.js compat layer on Bun). Hono provides:
- Zero-code migration to Node.js if Bun proves unstable in production
- Stable SSE streaming (`streamSSE()` helper)
- Good TypeScript DX with `hono/client` RPC
- Growing middleware ecosystem

Full evaluation in `docs/adr/ADR-0002-api-framework.md`.

### 3. Phased Code Sandbox

Instead of Firecracker from day 1:
- **Phase 1-3:** nsjail (Linux namespaces, deploys anywhere, adequate for authenticated users)
- **Phase 3+:** gVisor option (user-space kernel, stronger isolation without KVM)
- **Phase 4:** Firecracker microVMs (VM-level isolation for untrusted public code execution)

Abstract `SandboxBackend` interface from day 1 makes switching a config change.

**Default resource limits:**
- Timeout: 30 seconds (configurable per-org up to 120s)
- Memory: 256 MB
- CPU: 0.5 cores
- Disk: 100 MB (tmpfs)
- Network: disabled
- Supported languages: Python 3.12, Node.js 20, Bash

### 4. WebSocket via Redis Pub/Sub

Hono's WS helper lacks Bun pub/sub support. Architecture:
1. Hono `upgradeWebSocket()` for handshake and per-connection lifecycle
2. Redis pub/sub for message fan-out (required for horizontal scaling across API pods)
3. Optional: For single-pod high-throughput scenarios, drop to `Bun.serve()` native WebSocket API for specific endpoints (e.g., typing indicators) while using Redis for cross-pod events

### 5. SSE Hardening

Bun has a known issue where `idleTimeout` silently kills SSE streams:
- Set `idleTimeout: 0` on `Bun.serve()`
- Send heartbeat comments every 15 seconds
- Monitor for memory leaks on long-lived connections

---

## Locked Technology Stack

| Component | Technology | Version Strategy | Notes |
|-----------|-----------|-----------------|-------|
| Runtime (API) | Bun | Pin to latest stable; update monthly | With Node.js fallback via Hono |
| Runtime (Worker) | Node.js | 20 LTS | Required by Temporal Worker SDK |
| API Framework | Hono | ^4.12 (pin minor) | Multi-runtime, see ADR-0002 |
| Database (NOVA) | PostgreSQL | 16.x | + pgvector 0.7+ + pg_trgm |
| Database (Temporal) | PostgreSQL | 16.x | Separate instance for Temporal server |
| ORM | Drizzle | Pin 1.0-beta.x; upgrade to 1.0 when stable | + drizzle-kit + drizzle-zod |
| Cache/PubSub | Redis | 7.2+ | Sessions, pub/sub, rate limiting |
| Object Storage | MinIO | Pin RELEASE tag (e.g. RELEASE.2026-03-01) | S3-compatible |
| Model Gateway | LiteLLM | Pin Docker SHA digest | Python/FastAPI; all LLM calls routed through |
| Workflow Engine | Temporal | Pin auto-setup image tag (e.g. 1.24.x) | Durable workflows, human-in-loop |
| Auth | Better Auth | ^1.4 (pin minor) | Hono + Drizzle + multi-tenancy |
| Frontend | React 19 + Vite | React ^19.0, Vite ^6.0 | + Tailwind CSS v4 |
| Router | TanStack Router | ^1.x | Type-safe SPA routing |
| State (client) | Zustand | ^5.0 | UI state |
| State (server) | TanStack Query | ^5.0 | Server cache |
| Observability | OTEL Collector + LangFuse | LangFuse v3 self-hosted Docker | LLM tracing; uses NOVA PostgreSQL |
| Metrics | Prometheus + Grafana | Prometheus v2.50+, Grafana v10+ | Infrastructure metrics |
| Sandbox (MVP) | nsjail | Latest from GitHub | Phase 1-3; Linux namespaces |
| Sandbox (Prod) | Firecracker | v1.7+ | Phase 4+; requires KVM |
| License | FSL-1.1-Apache-2.0 | 1.1 | Converts to Apache 2.0 after 2 years |

**Version pinning policy:** Never use `latest` tag in Docker Compose or CI. Pin to specific image SHA digests or release tags. Test version bumps in staging before production.

---

## User Story Summary

Full inventory in `docs/USER_STORIES.md`. 234 total stories across 34 categories:

| Scope | Count |
|-------|-------|
| Original stories | 34 |
| New stories (from initial research) | 122 |
| Gap stories (from competitive analysis) | 78 |
| **Total** | **234** |

### New Categories Discovered

These categories were entirely missing from the original plan:

1. **Prompt Library & Templates** (8 stories) -- Save, share, version prompt templates
2. **Keyboard Shortcuts & Command Palette** (4 stories) -- Power user navigation
3. **Data Import/Export & GDPR** (5 stories) -- ChatGPT import, data portability, right to deletion
4. **Error Handling & Rate Limiting UX** (7 stories) -- User-facing error recovery
5. **Admin Onboarding & Health** (4 stories) -- Setup wizard, health dashboard
6. **Theming & White-labeling** (4 stories) -- Custom branding per org
7. **Search (Expanded)** (4 stories) -- Semantic search, cross-entity search
8. **Integrations** (5 stories) -- Slack, Teams, email, cloud storage, OpenAI-compat API
9. **User Onboarding** (4 stories) -- Tutorials, sample conversations
10. **Conversation Organization** (3 stories) -- Folders, tags, bulk operations
11. **Voice & Multimodal** (3 stories) -- Speech-to-text, TTS
12. **Model Playground** (1 story) -- Developer prompt testing
13. **Versioning & History** (2 stories) -- Message edit history, collection history
14. **Batch Operations** (2 stories) -- Batch API, bulk admin

---

## Risk Register

| # | Risk | Impact | Likelihood | Mitigation | Phase |
|---|------|--------|-----------|-------------|-------|
| R1 | Bun memory leaks in production | High | Medium | Hono allows Node.js fallback; isolate SSE/WS processes; monitor | 1 |
| R2 | Temporal Client (`@temporalio/client`) doesn't work under Bun | High | Low-Medium | **NOT YET VALIDATED.** Must validate in Sprint 0. Fallback: thin Node.js sidecar for Temporal client calls | 0 |
| R3 | Bun SSE idle disconnection | Medium | High (confirmed bug) | `idleTimeout: 0` + heartbeats every 15s; validate 30+ min streams in Sprint 0 | 0 |
| R4 | Drizzle ORM not at 1.0 yet (currently 1.0-beta) | Low | Medium | Pin exact beta version in package.json; test migration upgrades | 1 |
| R5 | Better Auth security surface | Medium | Low | Phase 1: security review of auth implementation; Phase 5: full pentest before SaaS launch | 1, 5 |
| R6 | Firecracker requires KVM hosts | Medium | Certain | nsjail for non-KVM deployments; document host requirements | 4 |
| R7 | Temporal infrastructure complexity (2nd PostgreSQL, 2-4GB RAM) | Medium | Certain | Docker Compose for dev; managed Temporal Cloud as option | 1 |
| R8 | pgvector memory pressure at scale | Low | Low | Partition by org_id; evaluate dedicated vector DB if >5M chunks | 4 |
| R9 | LiteLLM version instability (fast-moving Python project) | Low | Medium | Pin Docker image SHA digests; test upgrades in staging | 1 |
| R10 | Bun workspace limitations | Low | Medium | Can migrate to pnpm if needed | 1 |
| R11 | Redis single point of failure | Medium | Medium | Phase 1-4: single instance acceptable; Phase 5: Redis Sentinel for HA | 5 |
| R12 | Integration features lack technology research (Slack/Teams/voice) | Low | Certain | These are Phase 4-5 features; research during Phase 3 planning | 3 |
| R13 | No defined user role hierarchy | Medium | Certain | Define roles in Domain Model phase; map to Better Auth organizations plugin | 1 |

---

## Early Validation Checklist (Sprint 0)

Before committing to the full implementation, validate these in a 1-week spike:

**Critical (blocks architecture):**
- [ ] `@temporalio/client` works under Bun (start workflow, send signal, query). If this fails, evaluate: (a) thin Node.js sidecar for client calls, or (b) pivot to Trigger.dev v3
- [ ] Bun monorepo: `packages/api` (Bun) + `packages/worker` (Node.js) coexist with shared types

**High priority (blocks Phase 1 features):**
- [ ] Hono SSE streaming with `idleTimeout: 0` stays alive for 30+ minutes with 15s heartbeats
- [ ] Hono WebSocket + Redis pub/sub broadcasts to 100 concurrent connections
- [ ] Better Auth + Hono + Drizzle + PostgreSQL: sign up, log in, session management, org creation
- [ ] LiteLLM streaming completion -> Hono SSE -> browser renders tokens correctly

**Medium priority (blocks Phase 3 features):**
- [ ] Drizzle pgvector column: insert embedding, cosine similarity search, HNSW index creation
- [ ] nsjail executes Python code with resource limits on Linux (macOS dev uses Docker)

**Fallback decisions (document before Sprint 0 ends):**
- If Temporal client fails under Bun -> use Trigger.dev v3 OR Node.js sidecar
- If Bun SSE is unreliable -> switch API server to Node.js via Hono (zero code changes)
- If Better Auth lacks needed features -> evaluate Lucia Auth or custom auth layer

---

## User Roles

These roles map to Better Auth's organization plugin and are referenced throughout user stories:

| Role | Scope | Description |
|------|-------|-------------|
| **super-admin** | System-wide | Platform operator. Manages orgs, billing, system config. |
| **org-admin** | Organisation | Manages users, groups, settings, models, tools for one org. |
| **power-user** | Organisation | Can create agents, knowledge collections, workspaces. |
| **member** | Organisation | Can chat, use agents, upload files. Default role. |
| **viewer** | Organisation | Read-only access to shared conversations and workspaces. |

**Story mapping:** "As an admin" = org-admin or super-admin. "As a user" = member or above. "As a developer" = power-user with API key access.

---

## Phase Allocation (234 Stories)

> Story sources: ORIGINAL (core features), NEW (initial research additions), GAP (competitive analysis).
> ORIGINAL stories are distributed across Phases 1-3 (core product).
> NEW stories fill out each phase's feature set.
> GAP stories are primarily in Phases 4-5 (competitive catch-up and polish).
> Phase 5 has fewer stories but significant infrastructure/ops work not tracked as stories (K8s migration, security audit, load testing, documentation).

### Phase 1 -- MVP (8 weeks) | ~45 stories
Core auth, single-user conversations, SSE streaming, file uploads, basic UI.
Includes: Sprint 0 validation (1 week), infra setup, CI/CD.
Primary sources: ORIGINAL + essential NEW stories.

### Phase 2 -- Teams (6 weeks) | ~55 stories
Multi-tenancy, SSO, groups, multi-user conversations, WebSocket, workspaces.
Includes: Prompt library (basic), keyboard shortcuts, conversation organization.
Primary sources: ORIGINAL (multi-user) + NEW (collaboration features).

### Phase 3 -- Agents & Knowledge (8 weeks) | ~50 stories
Agent builder, tools, MCP, memory, knowledge collections, RAG pipeline.
Includes: Temporal workflows, human-in-the-loop, search expansion.
Primary sources: ORIGINAL (agents) + NEW (knowledge, tools).

### Phase 4 -- Power Features (10 weeks) | ~55 stories
Deep research, code interpreter (nsjail -> Firecracker upgrade), rich artifacts, admin panel, analytics.
Includes: Integrations (Slack/Teams), voice input, model playground, batch API.
Primary sources: NEW + GAP (competitive features).
Note: Firecracker upgrade happens here for KVM-capable hosts; nsjail remains the fallback.

### Phase 5 -- SaaS & Scale (12 weeks) | ~29 stories + significant ops work
Multi-tenant SaaS, billing, Kubernetes, GDPR compliance, accessibility audit.
Includes: White-labeling, data import/export, user onboarding, Redis HA.
Note: Lower story count but includes non-story work: K8s manifests, load testing, security pentest, documentation, operational runbooks.

---

## Deferred Technology Research (Phase 3 Planning)

These features are in Phase 4-5 and need technology research before implementation begins:

| Feature | Research Needed | When |
|---------|----------------|------|
| Slack integration | Slack Bolt SDK vs custom webhook. Bot user token scopes. | Phase 3 planning |
| Teams integration | Microsoft Bot Framework vs Graph API webhooks. | Phase 3 planning |
| Voice input (STT) | Deepgram vs Azure Speech vs Whisper (local). Streaming vs batch. | Phase 3 planning |
| Text-to-speech | ElevenLabs vs Azure TTS vs local (Piper). Streaming audio. | Phase 3 planning |
| Batch API | Queue design (Temporal vs BullMQ). Callback vs polling for results. | Phase 3 planning |
| Cloud storage sync | Google Drive API vs OneDrive Graph API. Webhook for change notifications. | Phase 4 planning |
| Billing (Stripe) | Stripe Billing vs custom metering. Usage-based pricing model. | Phase 4 planning |
| Email notifications | Resend vs Postmark vs SES. Transactional email templates. | Phase 2 planning |

---

## Document Index

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/REFINED_SYSTEM_PLAN.md` | This document -- master plan overview | Complete |
| `docs/USER_STORIES.md` | Complete 234-story inventory | Complete |
| `docs/TECHNOLOGY_RESEARCH.md` | Detailed technology evaluation (11 sections + MCP) | Complete |
| `docs/COMPETITIVE_ANALYSIS.md` | Open WebUI / LibreChat comparison + positioning | Complete |
| `docs/adr/ADR-0001-tech-stack.md` | Technology stack decisions and rationale | Complete |
| `docs/adr/ADR-0002-api-framework.md` | Hono selection over Elysia/Fastify | Complete |
| `docs/SECURITY.md` | Threat model, top 10 risks, audit logging, compliance | Complete |
| `infra/INFRASTRUCTURE.md` | Docker Compose, K8s, CI/CD, env vars, monitoring | Complete |
| `docs/intial_system_plan.md` | Original planning prompt (reference) | Reference |
| `LICENSE` | FSL-1.1-Apache-2.0 | Complete |
| `docs/DOMAIN_MODEL.md` | Entity model -- 29 groups, 59 tables, all fields and relationships | Complete |
| `docs/diagrams/er-diagram.mermaid` | Full ER diagram (59 entities) | Complete |
| `docs/diagrams/system-overview.mermaid` | C4 Context diagram -- all services and connections | Complete |
| `docs/diagrams/component-diagram.mermaid` | API package internal components | Complete |
| `docs/diagrams/temporal-workflows.mermaid` | 6 workflow sequence diagrams | Complete |
| `docs/diagrams/auth-flow.mermaid` | Azure Entra ID OIDC flow | Complete |
| `docs/diagrams/streaming-flow.mermaid` | SSE token streaming flow | Complete |
| `docs/diagrams/firecracker-sandbox.mermaid` | Sandbox execution flow (phased) | Complete |
| `docs/ROADMAP.md` | All 234 stories assigned to 5 phases with checkboxes | Complete |
| `docs/API_DESIGN.md` | All REST endpoints, WebSocket events, SSE streams (1225 lines) | Complete |
| `docs/DATABASE_SCHEMA.md` | Full SQL DDL with indexes, RLS, triggers (1830 lines) | Complete |
| `packages/api/IMPLEMENTATION.md` | Hono API server implementation guide | Complete |
| `packages/worker/IMPLEMENTATION.md` | Temporal worker implementation guide | Complete |
| `packages/web/IMPLEMENTATION.md` | React 19 SPA implementation guide | Complete |
| `packages/shared/IMPLEMENTATION.md` | Shared TypeScript code implementation guide | Complete |

---

## Next Steps

All planning documents are complete. The project is ready for Sprint 0 implementation:

1. **Sprint 0 (1 week):** Execute validation checklist (see Early Validation section above)
   - Validate `@temporalio/client` on Bun
   - Set up monorepo with Bun workspaces
   - Docker Compose with all 14 services running
   - Drizzle schema from DATABASE_SCHEMA.md, run first migration
   - Better Auth + Hono hello-world with session login
   - SSE streaming proof-of-concept with `idleTimeout: 0`
2. **Phase 1 Sprint 1-3:** Implement the 45 MVP stories per ROADMAP.md

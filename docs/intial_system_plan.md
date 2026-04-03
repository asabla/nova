# NOVA — Chat Platform
# Implementation Planning Prompt v2
# (Decisions locked in — ready for Claude Code)

---

## ✅ LOCKED DECISIONS

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Deployment | Self-hosted first, SaaS path designed in from day one | Multi-tenancy must be in the schema from the start; billing + metering added later |
| Code sandbox | Firecracker microVMs (fully self-hosted) | No dependency on e2b.dev; air-gapped deployments stay viable |
| API framework | Agent researches Elysia vs Hono vs Fastify + Bun and picks the best fit | Measured on: Bun compatibility, WebSocket support, middleware ecosystem, TypeScript DX |
| Streaming | SSE for unidirectional token streaming; WebSocket for bi-directional (multi-user chat, agent events, notifications) | Keeps things simple for the common case; WS only where genuinely needed |
| Client | Web-only initially; architecture must not block a React Native port later (shared `packages/shared` types, API-first) | |
| License | **FSL-1.1-Apache-2.0** (Functional Source License) | Blocks commercial forks and SaaS competitors; converts to Apache 2.0 after 2 years; contributor-friendly; used by Sentry + GitButler |

---

## 📋 FULL USER STORY INVENTORY

> ✅ = originally specified | NEW = discovered via research

---

### 🧑 Authentication & Identity

| # | Story |
|---|-------|
| ✅ | As a user I can sign up and log in with email + password |
| ✅ | As an admin I can configure SSO via Azure AD / Entra ID (OIDC) |
| NEW | As an admin I can configure SSO via Google Workspace |
| NEW | As an admin I can configure SSO via GitHub / GitLab |
| NEW | As a user I can use magic-link (passwordless) login |
| NEW | As an admin I can enforce MFA for all users |
| NEW | As a user I can set up TOTP (e.g. Google Authenticator) as 2FA |
| NEW | As a user I can manage my active sessions and revoke them |
| NEW | As an admin I can set password strength and expiry policies |
| NEW | As an admin I can view an audit log of all authentication events |

---

### 🏢 Tenancy & Organisations

| # | Story |
|---|-------|
| NEW | As a super-admin I can create and manage organisations (tenants) |
| NEW | As an org admin I can configure org-level settings (name, logo, domain) |
| NEW | As an org admin I can set a custom subdomain (org.nova.app or self-hosted root) |
| NEW | All data (conversations, files, agents, knowledge) is strictly scoped to an org |
| NEW | As a super-admin I can view cross-org usage for billing preparation |
| NEW | When SaaS mode is enabled, orgs can have a billing plan and payment method |

---

### 👥 Users & Groups

| # | Story |
|---|-------|
| ✅ | As an admin I can create and manage user groups |
| ✅ | As an admin I can group users with SSO (Entra ID) |
| NEW | As an admin I can assign roles: super-admin, org-admin, power-user, member, viewer |
| NEW | As an admin I can invite users by email with expiring links |
| NEW | As an admin I can bulk-import users via CSV |
| NEW | As an admin I can deactivate users without deleting their data |
| NEW | As an admin I can impersonate a user for support purposes (with audit trail) |
| NEW | As a user I can update my profile (name, avatar, timezone, language) |
| NEW | As an admin I can set per-group model access restrictions |
| NEW | As an admin I can set per-group monthly token/cost spending limits |
| NEW | As an admin I can view usage statistics per user and per group |
| NEW | As an admin I can set data retention policies per group |

---

### 💬 Conversations

| # | Story |
|---|-------|
| ✅ | As a user I can have a conversation with a model |
| ✅ | As a user I can share a conversation with other users |
| ✅ | As a user I can have multiple users in the same conversation |
| ✅ | As a user I can archive a conversation |
| ✅ | As a user I can delete a conversation |
| ✅ | As a user I can search my previous conversations |
| NEW | As a user I can fork a conversation at any message |
| NEW | As a user I can rename a conversation |
| NEW | As a user I can pin important conversations |
| NEW | As a user I can export a conversation as Markdown / PDF / JSON |
| NEW | As a user I can share a conversation as a public read-only link |
| NEW | As a user I can set conversation visibility: private, team, public |
| NEW | As a user I can replay a message with a different model |
| NEW | As a user I can edit a previous message and re-run from that point |
| NEW | As a user I can rate individual assistant messages (thumbs up/down) |
| NEW | As a user I can add private notes to any message |
| NEW | As a user I can @mention another user inside a shared conversation |
| NEW | As a user I can @mention an agent to pull it into the conversation |
| NEW | As a user I can see typing indicators in multi-user conversations |
| NEW | As a user I can set a custom system prompt per conversation |
| NEW | As a user I can adjust model parameters (temperature, top-p) per conversation |
| NEW | As a user I can see token count and estimated cost per conversation |
| NEW | As a user I can pause / resume a streaming response |
| NEW | As a user I can stop a running agent mid-flight |

---

### 🤖 Multi-turn & Agentic Conversations

| # | Story |
|---|-------|
| ✅ | As a user I can have multi-turn conversations where an agent asks for input before continuing |
| NEW | As a user I can approve or reject tool calls before they execute (human-in-the-loop) |
| NEW | As a user I can see a step-by-step trace of agent reasoning |
| NEW | As a user I can re-run a failed agent step |
| NEW | As a user I can set a max-steps / timeout budget for an agent run |
| NEW | As a user I can see the full tool call history in a collapsible panel |
| NEW | As a user I can see which sub-agents were spawned in a run |

---

### 📁 Files & Documents

| # | Story |
|---|-------|
| ✅ | As a user I can upload files and have conversations about them |
| ✅ | As a user I can upload multiple files at once |
| ✅ | As an admin I can administer uploaded files |
| NEW | Supported upload types: PDF, DOCX, XLSX, CSV, TXT, MD, PPTX, code files, images (PNG/JPG/WEBP/GIF), audio, video |
| NEW | As a user I can preview files inline before attaching |
| NEW | As a user I can remove an attachment before sending |
| NEW | As a user I can drag-and-drop files into the conversation |
| NEW | As a user I can paste an image from clipboard |
| NEW | As a user I can see my total storage usage |
| NEW | As an admin I can set per-user and per-group storage quotas |
| NEW | As an admin I can set allowed file types and max file sizes |

---

### 🌐 URL / Web References

| # | Story |
|---|-------|
| ✅ | As a user I can reference URLs and have a conversation about them |
| NEW | As a user I can paste a YouTube link and have it summarised |
| NEW | As a user I can paste an article URL and get a TL;DR |
| NEW | As a user I can see a preview card for attached URLs |
| NEW | As an admin I can whitelist/blacklist domains for URL scraping |
| NEW | SSRF protection must be enforced on all URL scraping (block private IP ranges) |

---

### 🔍 Deep Research

| # | Story |
|---|-------|
| ✅ | As a user I can initiate a deep-research task |
| NEW | As a user I can see a live progress feed (sources visited, queries run) |
| NEW | As a user I can receive a structured report with citations |
| NEW | As a user I can export a research report as PDF or DOCX |
| NEW | As a user I can configure how many sources / iterations the research uses |
| NEW | As a user I can re-run research with different parameters |

---

### 🛠️ Models & Providers

| # | Story |
|---|-------|
| NEW | As an admin I can configure LiteLLM proxy connection |
| NEW | As an admin I can add / remove model providers |
| NEW | As an admin I can set a default model per group |
| NEW | As a user I can switch models mid-conversation |
| NEW | As a user I can compare responses from two models side-by-side |
| NEW | As an admin I can set fallback models when primary models fail |
| NEW | As an admin I can view model latency, error rate, and cost dashboards |
| NEW | As a user I can see model capability badges (vision, function-calling, reasoning, etc.) |

---

### 🤖 Agents

| # | Story |
|---|-------|
| ✅ | As a user I can create custom agents |
| ✅ | As a user I can share agents with other users |
| ✅ | As a user I can attach skills to agents |
| ✅ | As a user I can attach tools to agents |
| ✅ | As a user I can attach MCP servers to agents |
| ✅ | As an agent I can store important bits into memory |
| ✅ | As an agent I can produce artifacts (files, images, audio, inline files) |
| NEW | As a user I can publish an agent to team / org / public marketplace |
| NEW | As a user I can version my agents |
| NEW | As a user I can test an agent with sample prompts before publishing |
| NEW | As a user I can configure agent memory scope: per-user, per-conversation, or global |
| NEW | As a user I can configure agent tool approval mode: auto, always-ask, or never |
| NEW | As an admin I can disable specific tools / MCP servers org-wide |
| NEW | As a user I can clone an existing agent as a starting point |
| NEW | As a user I can set an agent as default for a workspace |
| NEW | As a user I can trigger an agent via webhook |
| NEW | As a user I can schedule an agent run (cron) |
| NEW | As a developer I can call an agent via REST API using an API key |

---

### 🧠 Memory

| # | Story |
|---|-------|
| ✅ | As an agent I can store and recall memory |
| NEW | As a user I can view and edit my agent's memory |
| NEW | As a user I can delete specific memory entries |
| NEW | As a user I can import / export memory as JSON |
| NEW | As an admin I can set memory size limits per agent |

---

### 📦 Knowledge Collections

| # | Story |
|---|-------|
| ✅ | As a user I can create a knowledge collection (searchable set of files) |
| ✅ | As a user I can share a knowledge collection with other users |
| NEW | As a user I can add URLs to a knowledge collection |
| NEW | As a user I can re-index a collection after adding files |
| NEW | As a user I can test a collection with a sample query |
| NEW | As a user I can see which chunks were retrieved in a RAG response |
| NEW | As an admin I can configure the embedding model for collections |
| NEW | As an admin I can configure chunking strategy (size, overlap) |

---

### 🗂️ Workspaces / Projects

| # | Story |
|---|-------|
| ✅ | As a user I can create a workspace / project |
| ✅ | As a user I can upload files to a workspace |
| ✅ | As a user I can have conversations scoped to a workspace |
| NEW | As a user I can invite team members to a workspace |
| NEW | As a user I can set workspace-level defaults (agent, model, system prompt) |
| NEW | As a user I can archive a workspace |
| NEW | As an admin I can control which groups have access to which workspaces |
| NEW | As a user I can see an activity feed inside a workspace |

---

### 🎨 Artifacts & Rich Display

| # | Story |
|---|-------|
| ✅ | Conversations display: documents, Excel/CSV, images, video, YouTube, embedded pages |
| ✅ | Conversations can produce dynamic widgets (weather, external data) |
| ✅ | Agents can produce inline files (code, images, audio) |
| NEW | Rendered Markdown with syntax-highlighted code blocks |
| NEW | Mermaid / PlantUML diagrams rendered inline |
| NEW | LaTeX / math formulas rendered inline (KaTeX) |
| NEW | Code Interpreter — run code blocks in a Firecracker sandbox |
| NEW | As a user I can download any produced artifact |
| NEW | As a user I can open an artifact in full-screen preview |
| NEW | As a user I can save a produced artifact to my file library |
| NEW | Charts / graphs from agents render interactively |
| NEW | CSV data renders in a sortable / filterable table |
| NEW | Audio artifacts play inline |
| NEW | Video artifacts play inline |

---

### 🔧 Tools & Function Calling

| # | Story |
|---|-------|
| ✅ | As a user I can call tools via native function calling |
| NEW | As a user I can browse and enable tools from a tool marketplace |
| NEW | As a developer I can register a custom tool via OpenAPI spec |
| NEW | As a user I can test a tool before enabling it for an agent |
| NEW | As an admin I can review and approve custom tools before they go live |

---

### 🔗 MCP Servers

| # | Story |
|---|-------|
| ✅ | As an agent I can connect to MCP servers |
| NEW | As a user I can add an MCP server by URL |
| NEW | As a user I can browse available tools from a connected MCP server |
| NEW | As an admin I can whitelist approved MCP server URLs org-wide |
| NEW | As a user I can test MCP server connectivity from the UI |

---

### 📊 Analytics & Observability

| # | Story |
|---|-------|
| NEW | As an admin I can view total token usage over time |
| NEW | As an admin I can view cost breakdown by model, user, and group |
| NEW | As an admin I can set budget alerts per group |
| NEW | As a user I can see my personal usage dashboard |
| NEW | As an admin I can export usage data as CSV |
| NEW | As an admin I can view a trace of every agent run (LLM calls, tool calls, latency) |
| NEW | As an admin I can integrate with external observability tools (LangFuse, Helicone) |

---

### 🔔 Notifications

| # | Story |
|---|-------|
| NEW | As a user I receive in-app notifications when someone shares a conversation with me |
| NEW | As a user I receive email notifications for @mentions |
| NEW | As a user I can set notification preferences |
| NEW | As a user I can receive a webhook / Slack ping when an async agent run completes |

---

### 🌍 Internationalisation & Accessibility

| # | Story |
|---|-------|
| NEW | UI ships with English first; i18n-ready (i18next) |
| NEW | UI is screen-reader accessible (WCAG 2.1 AA) |
| NEW | Light and dark mode |
| NEW | Adjustable font size |

---

### 🛡️ Security & Compliance

| # | Story |
|---|-------|
| NEW | As an admin I can enable content filtering / moderation on inputs and outputs |
| NEW | As an admin I can configure DLP rules (block PII, credit card numbers, etc.) |
| NEW | As an admin I can view a full audit log of all user actions |
| NEW | As an admin I can rotate API keys |
| NEW | SSRF protection on all URL scraping and webhook calls |
| NEW | Prompt injection mitigations for user-supplied content |
| NEW | Firecracker sandbox enforces resource limits (CPU, memory, network, disk) |
| NEW | All data at rest is encrypted (pgcrypto / storage encryption) |
| NEW | All data in transit uses TLS 1.3+ |
| NEW | Rate limiting per user, per IP, and per group |

---

---

## 🔁 CLAUDE CODE — RALPH WIGGUM PLANNING LOOP PROMPT

> **How to use:**
> 1. Create an empty project directory and run `git init`
> 2. Save the block below as `AGENT.md` in the project root
> 3. Start a Claude Code session and say:
>    *"Follow the instructions in AGENT.md exactly. Start the Ralph Wiggum Loop."*
> 4. Alternatively run headless: `claude -p "$(cat AGENT.md)" --max-turns 80`

---

```markdown
# MISSION
You are the lead architect and planner for a new open-source AI chat platform
codenamed **NOVA**.

Your sole deliverable in this session is a complete, phased, actionable
implementation plan written to `docs/IMPLEMENTATION_PLAN.md` and its supporting
files listed at the end.

You will work using the **Ralph Wiggum Loop**:

  1. THINK   — Reason out loud (in a short paragraph) about what needs to be done next
  2. ACT     — Use tools: create files, write content, run shell commands
  3. REFLECT — Re-read everything you just wrote. Ask "Is this correct, complete,
               and consistent with everything else?" Fix it if not.
  4. LOOP    — Go back to THINK. Keep looping until the current phase is done.

The REFLECT step is **mandatory**. Never skip it. Never proceed to the next phase
until the current phase passes the REFLECT check.

---

# LOCKED DECISIONS (DO NOT RE-LITIGATE THESE)

| Topic | Decision |
|-------|----------|
| Deployment model | Self-hosted initially; multi-tenant SaaS architecture built in from day one so flipping the switch later requires config not refactoring |
| Code sandbox | Firecracker microVMs — fully self-hosted, no e2b.dev dependency |
| API framework | Research Elysia vs Hono vs Fastify-on-Bun. Pick the best fit for: Bun native compatibility, WebSocket support, middleware ecosystem, TypeScript DX. Document the choice as ADR-0002. |
| Streaming | SSE for unidirectional token streaming (chat completions). WebSocket for bi-directional (multi-user typing indicators, agent step events, real-time notifications). |
| Client | Web-only for v1. Architecture must not block a future React Native port: API-first, shared types in `packages/shared`, no web-only assumptions in business logic. |
| License | FSL-1.1-Apache-2.0 (Functional Source License). Blocks commercial exploitation by third parties. Converts to Apache 2.0 after 2 years. All source files must include the SPDX header: `SPDX-License-Identifier: FSL-1.1-Apache-2.0` |
| AI proxy | LiteLLM (Docker) as the universal model gateway. All LLM calls go through LiteLLM. Never call provider APIs directly from application code. |
| Workflow engine | Temporal for all durable async work: agent loops, deep research, file ingestion, scheduled runs, notifications |
| Database | PostgreSQL 16 + pgvector (RAG) + pg_trgm (full-text search). ORM: Drizzle ORM + drizzle-kit for migrations. |
| Cache / queue | Redis 7. Used for: session store, pub/sub (SSE fan-out), rate limiting, job deduplication |
| Object storage | RustFS (S3-compatible). All files — uploads, artifacts, exports — go through RustFS. |
| Auth library | Better Auth with: local credentials adapter, Azure Entra ID OIDC adapter, magic-link adapter |
| Observability | OpenTelemetry → LangFuse for LLM tracing. Prometheus + Grafana for infrastructure. |
| Monorepo | Bun workspaces. Single `package.json` at root, packages under `packages/`. |
| Frontend build | Vite + React 19 + Tailwind CSS v4 + Bun |

---

# PHASE 0 — BOOTSTRAP

THINK about the current state of the repository, then:

1. Run `ls -la` to see what already exists.
2. Create this directory tree (skip any that already exist):
   ```
   docs/
   docs/adr/
   docs/diagrams/
   packages/
   packages/api/
   packages/web/
   packages/worker/
   packages/shared/
   infra/
   infra/docker/
   infra/k8s/
   ```
3. Write `LICENSE` using the FSL-1.1-Apache-2.0 template.
   (Use the canonical text from: https://fsl.software)
4. Write `docs/adr/ADR-0001-tech-stack.md`:
   - Format: Title / Status / Date / Context / Decision / Consequences
   - One ADR entry per major technology. Cover every row in the LOCKED DECISIONS table.
5. Write `docs/adr/ADR-0002-api-framework.md`:
   - Evaluate Elysia, Hono, and Fastify+Bun.
   - Compare on: Bun native support, WebSocket, middleware, TypeScript, community.
   - Select one. Status: Accepted.

REFLECT: Re-read both ADRs. Are they honest about trade-offs? Fix anything hand-wavy.

---

# PHASE 1 — DOMAIN MODEL

THINK: What are all the core domain entities this system needs?

ACT:
Write `docs/DOMAIN_MODEL.md` with every entity, its key fields, and its relationships.

Required entities (add more if you find gaps):
```
Organisation, OrgSetting
User, UserProfile, Session, MfaCredential
Group, GroupMembership
SsoProvider, SsoSession
ApiKey
Workspace, WorkspaceMembership
Conversation, ConversationParticipant, Message, MessageAttachment, MessageRating
File, FileChunk (for large file streaming)
KnowledgeCollection, KnowledgeDocument, KnowledgeChunk
Agent, AgentVersion, AgentSkill, AgentTool, AgentMcpServer, AgentMemoryEntry
McpServer, McpTool
Tool, ToolVersion, ToolCall
Artifact (files, images, audio produced by agents)
Workflow (Temporal correlation ID + status)
AuditLog
Notification
UsageStat (per user, per model, per day)
ModelProvider, Model
ContentFilter, DlpRule
```

For each entity include:
- Field name, type, nullable, default
- Primary key strategy (UUID v7 preferred over v4 for sortability)
- Which org/user it belongs to (tenancy scoping)
- Soft-delete strategy (deleted_at timestamp, not hard deletes)

Then write `docs/diagrams/er-diagram.mermaid` — a full erDiagram in Mermaid syntax.

REFLECT: Does every user story in the user story inventory map to at least one entity?
Cross-check. Add any missing entities before continuing.

---

# PHASE 2 — API DESIGN

THINK: What REST and WebSocket surfaces are needed?

ACT:
Write `docs/API_DESIGN.md` with every endpoint grouped by domain.

Domains to cover:
- Auth (login, logout, magic-link, TOTP, session management, SSO callback)
- Users (CRUD, avatar, preferences, usage)
- Groups (CRUD, membership)
- Organisations (settings, SSO provider config, billing stub)
- Workspaces (CRUD, membership, file library)
- Conversations (CRUD, fork, share link, export, search)
- Messages (create, edit, re-run, rate, notes)
- Files (upload, download, delete, admin list)
- KnowledgeCollections (CRUD, add file, add URL, reindex, query)
- Agents (CRUD, publish, clone, version, test)
- Tools (browse, register via OpenAPI, test)
- McpServers (register, list tools, test connectivity)
- Models (list, capability flags)
- ModelProviders (admin CRUD)
- DeepResearch (start, status stream, cancel)
- Artifacts (list, download, save to library)
- Webhooks (register, list, test)
- Admin (users, groups, usage, audit log, content filters)
- Search (cross-entity full-text search)

For each endpoint document:
```
METHOD   /path
Auth:    (required scope / role)
Request: { field: type, ... }
Response: { field: type, ... }
Notes:   any important behaviour
```

WebSocket protocol section — document the message envelope format and all event types:
- `stream.token` — next token from LLM
- `stream.done` — stream complete
- `stream.error` — stream failed
- `agent.step` — agent reasoning step
- `agent.tool_call` — tool invocation (with approval request flag)
- `agent.tool_result` — tool result
- `agent.approval_required` — waiting for user approval
- `agent.done` — agent run complete
- `conversation.message` — new message in shared conversation
- `conversation.typing` — typing indicator
- `notification` — push notification
- `workflow.progress` — deep research / file ingestion progress

REFLECT: Is every user story covered by at least one endpoint or WebSocket event?
Fill any gaps.

---

# PHASE 3 — DATABASE SCHEMA

ACT:
Write `docs/DATABASE_SCHEMA.md` with:

1. Full SQL DDL for every table (PostgreSQL 16 syntax)
2. All indexes:
   - B-tree on all foreign keys and commonly filtered fields
   - GIN index on tsvector columns (full-text)
   - ivfflat index on vector columns (pgvector, lists=100)
   - Composite indexes for multi-column queries
3. Migration strategy:
   - Use drizzle-orm with drizzle-kit
   - Each migration is a numbered SQL file in `packages/api/src/db/migrations/`
   - Never edit a migration after it has been run in production; always add new ones
4. Seed strategy for local development:
   - One org, two users (admin + regular), sample conversation, sample agent

Naming conventions:
- Tables: snake_case plural (e.g. `conversation_participants`)
- Columns: snake_case
- PKs: `id UUID DEFAULT gen_random_uuid()` (prefer UUIDv7 via pgcrypto extension or app-level generation)
- FKs: `{table_singular}_id`
- Timestamps: `created_at`, `updated_at`, `deleted_at` (soft delete) on every table

REFLECT:
- Does every entity from Phase 1 have a table?
- Are all foreign keys correct and cascades sensible (CASCADE delete vs SET NULL)?
- Are there missing indexes that would cause slow queries at scale?

---

# PHASE 4 — ARCHITECTURE DIAGRAMS

Write the following Mermaid diagrams:

### `docs/diagrams/system-overview.mermaid`
C4 Context diagram showing:
- External users (browser)
- NOVA system boundary
- External systems: LiteLLM, Azure Entra ID, email provider, MCP servers

### `docs/diagrams/component-diagram.mermaid`
C4 Component diagram for the API package:
- Router layer
- Auth middleware
- Domain services (ConversationService, AgentService, KnowledgeService, etc.)
- LiteLLM client
- Temporal client
- RustFS client
- Redis client
- Drizzle DB client

### `docs/diagrams/temporal-workflows.mermaid`
Sequence diagrams for each Temporal workflow:

**AgentRunWorkflow:**
User sends message → API starts workflow → Worker calls LLM → if tool_call:
  check approval mode → if needs approval: signal back to UI, wait for signal →
  execute tool via activity → loop → final message → complete

**DeepResearchWorkflow:**
User starts research → parallel search activities (N queries) →
collect results → synthesis LLM call → citation extraction →
report assembly → complete

**FileIngestionWorkflow:**
File uploaded to RustFS → extract text (activity) →
chunk text (activity) → embed chunks in parallel (activity) →
upsert into pgvector (activity) → mark document indexed → complete

**KnowledgeReindexWorkflow:**
Delete existing chunks → re-run FileIngestionWorkflow for each doc → complete

**ScheduledAgentWorkflow:**
Cron trigger → look up agent config → start AgentRunWorkflow → complete

**NotificationWorkflow:**
Event emitted → fan-out to users → in-app (Redis pub/sub) + email → complete

### `docs/diagrams/auth-flow.mermaid`
Sequence: Azure Entra ID OIDC login flow
Browser → /auth/sso/entra → redirect to Microsoft → callback → token exchange →
Better Auth session → JWT issued → redirect to app

### `docs/diagrams/streaming-flow.mermaid`
SSE token streaming:
Client POST /conversations/{id}/messages →
API creates Message row (status: streaming) →
API calls LiteLLM streaming endpoint →
API opens SSE connection to client →
tokens fan-out through Redis pub/sub (so multiple API pods can serve the same stream) →
stream.done event → Message row updated (status: complete)

### `docs/diagrams/firecracker-sandbox.mermaid`
Code execution request → API → Worker activity →
Firecracker VM manager: create microVM → inject code + dependencies →
run with resource limits (CPU 0.5 core, RAM 256MB, 30s timeout, no network) →
collect stdout/stderr/artifacts → destroy VM → return result

REFLECT: Are all diagrams internally consistent with the API design and domain model?
Fix any discrepancies.

---

# PHASE 5 — PHASED DELIVERY ROADMAP

THINK: What is the absolute minimum to have a working, useful product?

ACT:
Write `docs/ROADMAP.md` with the following phases.
Every user story from the inventory must appear in exactly one phase.
Mark each story with a checkbox [ ] for tracking.

---

### 🟢 Phase 1 — MVP (Target: 8 weeks)
*Goal: One user can have a reliable conversation with an AI model.*

Infrastructure:
- [ ] Bun monorepo scaffold with workspaces
- [ ] Docker Compose: postgres, redis, rustfs, litellm, api, web
- [ ] Drizzle migrations running on startup
- [ ] CI: GitHub Actions lint + type-check + test

Auth:
- [ ] Email + password sign-up and login (Better Auth)
- [ ] Session management + logout
- [ ] Basic user profile (name, avatar)

Conversations:
- [ ] Create, rename, delete conversations
- [ ] SSE token streaming (text-only)
- [ ] Model selector (from LiteLLM model list)
- [ ] Markdown rendering with syntax-highlighted code blocks
- [ ] Basic conversation list + search (pg_trgm)
- [ ] Archive conversation

Files:
- [ ] Upload: PDF, images, text, code files
- [ ] Inline preview of uploaded files
- [ ] File sent as context in conversation

UI:
- [ ] Conversation list sidebar
- [ ] Message thread view
- [ ] Light / dark mode

---

### 🟡 Phase 2 — Teams (Target: +6 weeks)
*Goal: Multiple users can collaborate.*

Multi-tenancy:
- [ ] Organisation model in DB (all data scoped to org)
- [ ] Org admin settings page

Auth:
- [ ] SSO: Azure Entra ID OIDC
- [ ] Magic-link (passwordless) login
- [ ] MFA: TOTP

Users & Groups:
- [ ] User invite by email
- [ ] Groups + role-based access
- [ ] Per-group model restrictions
- [ ] Per-group spending limits

Conversations:
- [ ] Multi-user conversations (invite by email or @mention)
- [ ] WebSocket: typing indicators, real-time message delivery
- [ ] Share conversation (public read-only link)
- [ ] Conversation visibility: private / team / public
- [ ] Fork conversation at a message
- [ ] Export conversation as Markdown / JSON

Workspaces:
- [ ] Create / archive workspaces
- [ ] Upload files to workspace file library
- [ ] Scope conversations to a workspace

Files:
- [ ] Drag-and-drop upload
- [ ] Paste image from clipboard
- [ ] Storage quota per user / group

---

### 🔵 Phase 3 — Agents & Knowledge (Target: +8 weeks)
*Goal: Agents can use tools, memory, and knowledge.*

Agents:
- [ ] Agent builder UI (name, avatar, model, system prompt, tools, memory config)
- [ ] Agents usable in conversations (via @mention)
- [ ] Agent versioning
- [ ] Clone agent
- [ ] Share / publish agent within org

Tools:
- [ ] Built-in tools: web search, calculator, weather, image generation
- [ ] Register custom tool via OpenAPI spec
- [ ] Tool test harness in UI

MCP:
- [ ] Register MCP server by URL
- [ ] Browse MCP tools in UI
- [ ] MCP server connectivity test
- [ ] Org-level MCP server allowlist

Memory:
- [ ] Per-conversation memory
- [ ] Long-term memory per user-agent pair
- [ ] View / edit / delete memory in UI

Knowledge Collections:
- [ ] Create collection, add files, add URLs
- [ ] FileIngestionWorkflow (Temporal): extract → chunk → embed → pgvector
- [ ] RAG: embed query → hybrid search (pgvector + pg_trgm) → inject context
- [ ] Show retrieved chunks in UI
- [ ] Share collection within org
- [ ] Configurable embedding model + chunking strategy

Temporal integration:
- [ ] AgentRunWorkflow with human-in-the-loop tool approval
- [ ] Agent step trace in UI (collapsible)
- [ ] Stop agent mid-flight

---

### 🟣 Phase 4 — Power Features (Target: +10 weeks)
*Goal: Deep research, code execution, rich artifacts, admin.*

Deep Research:
- [ ] DeepResearchWorkflow (Temporal): parallel search → synthesis → citations
- [ ] Live progress feed in UI
- [ ] Export report as PDF / DOCX
- [ ] Configurable depth / source count

Code Interpreter:
- [ ] Firecracker VM manager service
- [ ] Code execution activity in Temporal worker
- [ ] Run code blocks from chat (Python, JS, Bash)
- [ ] Resource limits enforced (CPU, RAM, timeout, no network)
- [ ] Artifacts (files produced by code) collected and displayed

Rich Artifacts:
- [ ] Mermaid / PlantUML diagrams rendered inline
- [ ] LaTeX / math rendered (KaTeX)
- [ ] Interactive charts (Recharts / Plotly)
- [ ] CSV → sortable filterable table
- [ ] Audio player
- [ ] Video player
- [ ] Dynamic widgets (weather, etc.)
- [ ] Full-screen artifact preview
- [ ] Save artifact to file library
- [ ] Download artifact

Agent Marketplace:
- [ ] Publish agent publicly
- [ ] Browse / install public agents
- [ ] Agent ratings and reviews stub

Scheduling:
- [ ] ScheduledAgentWorkflow (cron)
- [ ] Trigger agent via webhook
- [ ] Developer REST API + API key management

Admin Panel:
- [ ] User management (invite, deactivate, impersonate)
- [ ] Group management
- [ ] Model provider configuration
- [ ] Usage dashboards (token, cost by model/user/group)
- [ ] Budget alerts
- [ ] Audit log viewer
- [ ] Content filtering / DLP rules config

Observability:
- [ ] OpenTelemetry integration
- [ ] LangFuse tracing for LLM calls
- [ ] Prometheus metrics + Grafana dashboard

Notifications:
- [ ] In-app notifications
- [ ] Email notifications for @mentions
- [ ] Webhook / Slack ping on async job complete
- [ ] Notification preferences

---

### ⚪ Phase 5 — SaaS & Scale (Target: +12 weeks)
*Goal: Flip to SaaS mode, Kubernetes, billing.*

Multi-tenancy SaaS:
- [ ] Org self-service signup
- [ ] Billing plan model (stripe integration)
- [ ] Usage metering → invoice
- [ ] Custom subdomain per org

Auth:
- [ ] Google Workspace SSO
- [ ] GitHub SSO
- [ ] Session revocation UI
- [ ] Org-enforced MFA policy
- [ ] Password policy settings

Infrastructure:
- [ ] Kubernetes manifests for all services
- [ ] cert-manager + Let's Encrypt TLS
- [ ] Horizontal pod autoscaling for api + worker
- [ ] PgBouncer connection pooling
- [ ] S3 (AWS) as production RustFS alternative
- [ ] Secrets management (External Secrets Operator + AWS Secrets Manager / Vault)
- [ ] Database backup strategy (pg_dump → RustFS/S3 daily)
- [ ] Multi-region deployment notes

Internationalisation:
- [ ] i18next setup
- [ ] English as base language, translation pipeline documented

Accessibility:
- [ ] WCAG 2.1 AA audit
- [ ] Screen reader pass
- [ ] Keyboard navigation pass

---

### ⚫ Future / Backlog
*Not committed to a phase yet:*
- [ ] React Native mobile app
- [ ] Multi-agent orchestration (agents spawning agents)
- [ ] Agent A/B testing
- [ ] Notion / Confluence connector for knowledge collections
- [ ] Compare responses from two models side-by-side
- [ ] GitLab SSO
- [ ] Data residency region configuration
- [ ] FIPS-140 mode

---

REFLECT: Does every user story from the inventory appear in exactly one phase?
Do any phases have too much scope to finish in the stated time?
Adjust until the roadmap is honest and achievable.

---

# PHASE 6 — PACKAGE IMPLEMENTATION PLANS

Write `packages/api/IMPLEMENTATION.md`, `packages/web/IMPLEMENTATION.md`,
`packages/worker/IMPLEMENTATION.md`, `packages/shared/IMPLEMENTATION.md`.

Each file must cover:

### packages/api
- Chosen framework (from ADR-0002) and project structure
- Middleware stack (auth, rate-limit, request-id, CORS, error handler)
- Route registration pattern
- WebSocket handler design (upgrade, rooms, event dispatch)
- LiteLLM client: streaming, function calling, retry on 429, model fallback
- SSE implementation: token-by-token fan-out via Redis pub/sub across API pods
- File upload pipeline: multipart → RustFS presigned URL → FileIngestionWorkflow trigger
- RAG pipeline: embed query via LiteLLM → pgvector cosine search → context window packing
- Temporal client: workflow start, signal, query patterns
- Better Auth configuration: adapters, session cookie settings, PKCE for Entra
- Rate limiting: per-user token bucket via Redis
- Audit logging: middleware that writes to audit_logs table async

### packages/web
- Component hierarchy: design tokens → atoms → molecules → organisms → layouts → pages
- Tailwind CSS v4 config and design token strategy
- State management: Zustand for UI state + TanStack Query for server state
- WebSocket client: connection lifecycle, reconnect with exponential backoff, message queue
- SSE streaming renderer: token-by-token, word-wrap, cursor blink
- Markdown renderer: react-markdown + rehype-highlight + rehype-katex + remark-mermaid
- Artifact renderer: type-dispatch to sub-renderers (code, image, video, chart, table, widget)
- File upload: react-dropzone + paste-from-clipboard + upload progress
- Route structure (React Router v7 or TanStack Router — evaluate and pick)
- i18n setup with i18next (English only initially but wired up)
- Mobile-readiness checklist: no hardcoded pixel widths, touch targets ≥44px, no hover-only interactions

### packages/worker
- Temporal worker config (task queues: `agent`, `research`, `ingestion`, `notification`)
- Activity implementations:
  - `callLlm(params)` → LiteLLM streaming call, returns full text + tool calls
  - `executeToolCall(toolCall)` → dispatches to tool registry
  - `executeMcpToolCall(server, toolCall)` → MCP client call
  - `scrapeUrl(url)` → Playwright headless fetch with SSRF guard
  - `embedText(chunks[])` → LiteLLM embeddings API
  - `upsertChunks(chunks[])` → pgvector bulk insert
  - `runInSandbox(code, lang)` → Firecracker VM spawn + execute + collect
  - `sendNotification(event)` → Redis pub/sub + email queue
  - `extractFileText(fileKey)` → RustFS fetch + PDF/DOCX/XLSX text extraction
- Workflow definitions with full signal/query handler specs
- Error handling: activity retries (exponential backoff), workflow cancellation cleanup
- Firecracker VM manager: pool of pre-warmed VMs, assignment on demand, hard timeout kill

### packages/shared
- TypeScript types auto-generated from Drizzle schema (`drizzle-zod`)
- Additional hand-written types: API request/response shapes, WebSocket message envelope
- Zod validation schemas for all API inputs
- Shared constants: model capability flags, tool categories, permission scopes, event names
- Utility functions usable in both api and web: date formatting, token counting estimate, truncation

REFLECT: Is any package missing a critical piece? Are there circular dependencies between packages?
Shared types must only flow downward: shared → api, shared → web, shared → worker.

---

# PHASE 7 — INFRASTRUCTURE PLAN

Write `infra/INFRASTRUCTURE.md` covering:

### Docker Compose (local dev)
Services: api, web, postgres, redis, rustfs, litellm, temporal, temporal-ui, langfuse, prometheus, grafana

For each service document:
- Docker image + version pin
- Ports exposed
- Volumes
- Environment variables
- Health check
- Startup dependency order

### Environment Variable Matrix
Table: Variable | Used by | Example value | Secret? | Notes

### Local Dev Experience
- Single command: `bun run dev` starts all Docker services + api watch + web HMR
- `bun run db:migrate` runs drizzle migrations
- `bun run db:seed` seeds development data
- `bun run test` runs all tests

### Kubernetes (Production)
For each service write a summary of its Deployment, Service, and Ingress spec.
Highlight: replica counts, resource requests/limits, HPA config, PVC claims.

### Firecracker Deployment
- Firecracker requires KVM access: note the node requirements (bare metal or VMs with nested virt)
- jailer configuration for isolation
- VM image build process (minimal Linux + language runtimes)
- VM pool management: pre-warm N VMs, recycle after use

### CI/CD
GitHub Actions pipeline:
1. `lint` — eslint + prettier check
2. `typecheck` — tsc --noEmit across all packages
3. `test` — bun test
4. `build` — bun build all packages
5. `docker-build` — build and push images to registry
6. `deploy-staging` — kubectl rollout (on push to main)
7. `deploy-prod` — kubectl rollout (on semver tag)

REFLECT: Is the infrastructure plan realistic for a small team to operate?
Are there single points of failure? Flag them.

---

# PHASE 8 — SECURITY REVIEW

Write `docs/SECURITY.md`:

### Threat Model
- Who are the actors (anonymous, authenticated user, org admin, super-admin, external attacker)?
- What data are they targeting?
- What can go wrong at each trust boundary?

### Top Risks & Mitigations (cover ALL of these)
1. **Prompt injection** — User injects instructions via uploaded files or URLs. Mitigation: sandboxed system prompt; file content injected as tool results not system context; output validation.
2. **SSRF** — URL scraping hits internal services. Mitigation: allowlist/denylist of IP ranges; no requests to RFC1918 ranges; Playwright runs in Firecracker with no access to host network.
3. **Insecure direct object reference** — User accesses another org's data. Mitigation: all queries include `org_id = $orgId` enforced at service layer; integration tests verify cross-org isolation.
4. **Firecracker escape** — Code execution escapes the microVM. Mitigation: jailer + cgroups + seccomp; no shared filesystem; network disabled in sandbox VMs; kernel hardening notes.
5. **Tool / MCP abuse** — Agent calls a destructive tool without user awareness. Mitigation: tool approval modes; tool capability declarations reviewed by admin; audit log of every tool call.
6. **Session hijacking** — Cookie theft. Mitigation: HttpOnly + SameSite=Strict + Secure cookies; short session TTL with refresh tokens; anomaly detection on session reuse from new IP.
7. **Stored XSS** — Malicious Markdown in messages. Mitigation: DOMPurify sanitisation before rendering; strict CSP header; no dangerouslySetInnerHTML without sanitisation.
8. **API key leakage** — Developer API keys committed to repos. Mitigation: keys are hashed in DB (only shown once on creation); revocation endpoint; GitHub secret scanning partner integration notes.
9. **Mass assignment** — Client sends extra fields that modify unexpected columns. Mitigation: Zod schema validation on all inputs; ORM never does `INSERT ... values(req.body)` directly.
10. **DDoS / resource exhaustion** — High-frequency LLM calls. Mitigation: token bucket rate limiting in Redis; per-org spending limits; Temporal workflow concurrency limits.

### Audit Logging
Every state-changing action must write an `audit_logs` row including:
- actor_id, actor_ip, org_id, action, resource_type, resource_id, before_state (JSON), after_state (JSON), timestamp

REFLECT: Does each risk have a concrete mitigation that is actually implemented in a roadmap phase?
If a mitigation is only "planned for later", flag it with ⚠️ and the phase it lands in.

---

# FINAL DELIVERABLE

When all phases are complete:

1. Write `docs/EXECUTIVE_SUMMARY.md`:
   - What NOVA is (2 sentences)
   - Why it's different from ChatGPT, Claude.ai, Open WebUI (3 bullet points)
   - Tech stack at a glance (table)
   - 5-phase delivery timeline (one sentence per phase)
   - Licensing (FSL-1.1-Apache-2.0 — what it means for users and contributors)

2. Write `docs/IMPLEMENTATION_PLAN.md`:
   A master index that links to every doc created in phases 0–8.
   Include a "start here" guide for a new engineer joining the project.

3. Run a final REFLECT pass across ALL documents.
   Ask: "If a senior full-stack engineer picked this up cold tomorrow, could they build it?"
   Fix anything that is vague, missing, or contradictory.

4. Print a manifest:
   ```
   ✅ NOVA PLAN COMPLETE
   Files created:
   - docs/adr/ADR-0001-tech-stack.md
   - docs/adr/ADR-0002-api-framework.md
   - docs/DOMAIN_MODEL.md
   - docs/diagrams/er-diagram.mermaid
   - docs/API_DESIGN.md
   - docs/DATABASE_SCHEMA.md
   - docs/diagrams/system-overview.mermaid
   - docs/diagrams/component-diagram.mermaid
   - docs/diagrams/temporal-workflows.mermaid
   - docs/diagrams/auth-flow.mermaid
   - docs/diagrams/streaming-flow.mermaid
   - docs/diagrams/firecracker-sandbox.mermaid
   - docs/ROADMAP.md
   - packages/api/IMPLEMENTATION.md
   - packages/web/IMPLEMENTATION.md
   - packages/worker/IMPLEMENTATION.md
   - packages/shared/IMPLEMENTATION.md
   - infra/INFRASTRUCTURE.md
   - docs/SECURITY.md
   - docs/EXECUTIVE_SUMMARY.md
   - docs/IMPLEMENTATION_PLAN.md
   - LICENSE
   ```

---

# NON-NEGOTIABLE RULES

- Never fabricate library version numbers. Write "TBD — verify latest stable" if unsure.
- Never skip the REFLECT step.
- Never hard-code org_id=1 or any assumption of a single tenant anywhere.
- All TypeScript examples must be strictly typed — no `any`.
- All Mermaid diagrams must be syntactically valid.
- MVP scope is sacred. Do not add Phase 2+ features to Phase 1.
- Flag every technically risky or ambiguous item with ⚠️ and a short explanation.
- FSL-1.1-Apache-2.0 SPDX header goes in every source file header example you write.
```

---

## 🚀 QUICK START

```bash
# 1. Create project
mkdir nova && cd nova && git init

# 2. Save the prompt block above
cat > AGENT.md << 'EOF'
[paste the prompt block]
EOF

# 3. Run the planning loop
claude --max-turns 80 \
  "Follow the instructions in AGENT.md exactly. Start at Phase 0 and run the Ralph Wiggum Loop until you print NOVA PLAN COMPLETE."
```

Total output: ~25 documents covering domain model, API surface, DB schema,
architecture diagrams, phased roadmap, security review, and per-package
implementation plans.

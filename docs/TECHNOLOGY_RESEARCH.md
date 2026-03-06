# NOVA -- Technology Research Findings

> Comprehensive research conducted 2026-03-06.
> Each section includes findings, trade-offs, and risk flags.

---

## 1. API Framework: Hono (Selected)

### Key Findings
- **GitHub:** ~29,200 stars, 304 contributors, daily releases
- **Bun support:** Native adapter, no compat layer needed
- **SSE:** `streamSSE()` helper is stable, no serialization bugs
- **WebSocket:** Basic support via `hono/ws`; does NOT expose Bun's native pub/sub (issue #3230)
- **Middleware:** CORS, JWT, Bearer Auth, Cookie, Secure Headers, Logger, Compress, Cache, `@hono/zod-openapi`
- **TypeScript:** Strong inference via `hono/client` RPC, Zod validator integration
- **Multi-runtime:** Same code runs on Bun, Node.js, Deno, Cloudflare Workers

### Critical Bun Issues (affects ALL frameworks)
- `idleTimeout` silently kills SSE streams after ~10s (Bun #27479) -- set `idleTimeout: 0`
- Memory leaks reported in production (Bun #16503, #17723, #25948)
- SSL race condition causing segfaults (Bun #27838, Mar 2026)
- Recommendation: Monitor memory, have Node.js fallback ready

### WebSocket Architecture Decision
Since Hono's WS helper lacks pub/sub, use this pattern:
1. Hono `upgradeWebSocket()` for handshake
2. Redis pub/sub for message fan-out (required for horizontal scaling anyway)
3. Optional: Drop to `Bun.serve()` native WS for specific high-throughput endpoints

---

## 2. Temporal Workflow Engine

### Key Findings
- **TypeScript Worker: REQUIRES Node.js** -- cannot run on Bun
- Workers depend on `worker_threads`, `vm` module, Node-API native modules
- `@temporalio/client` (used in API server) is lighter and MAY work under Bun (gRPC calls only)
- Needs validation early in development

### Architecture Consequence
```
packages/api/    --> Bun + Hono (uses @temporalio/client)
packages/worker/ --> Node.js (uses @temporalio/worker)
packages/shared/ --> Pure TypeScript (works in both)
```

### Deployment
- Temporal server: `temporalio/auto-setup:latest` with PostgreSQL backend
- Temporal UI: `temporalio/ui:latest` on port 8233
- RAM: ~2-4GB for Temporal server in production
- Has its own PostgreSQL database (separate from NOVA's)

### Alternatives Considered
| Engine | Bun Support | Durability | Human-in-Loop | Self-hosted | Maturity |
|--------|-------------|------------|----------------|-------------|----------|
| Temporal | Client only | Excellent | Native signals | Yes | Battle-tested |
| BullMQ | Yes (Redis) | Good | Manual (polling) | Yes | Mature |
| Trigger.dev v3 | Yes | Good | `wait.forToken()` | Yes | Newer |
| Inngest | Yes | Good | Step-based | Cloud + self-host | Newer |
| Custom Redis | Yes | DIY | DIY | Yes | N/A |

**Recommendation:** Temporal remains the best choice. The Node.js worker requirement is manageable since the worker is a separate service. If the Node.js dependency is a dealbreaker, **Trigger.dev v3** is the strongest alternative.

### Early Validation Required
Before full commitment, validate:
1. `@temporalio/client` works under Bun (start workflow, send signal)
2. If client fails under Bun, evaluate thin Node.js sidecar or Trigger.dev pivot

---

## 3. Better Auth

### Key Findings
- TypeScript-native authentication library
- First-class Hono integration (documented on hono.dev)
- Works with Bun runtime
- Drizzle ORM adapter for PostgreSQL
- **Built-in multi-tenancy**: organizations, teams, roles, invitations, member management

### Supported Auth Methods
- Email/password with configurable password hashing
- OAuth: Azure Entra ID, Google, GitHub (OIDC)
- Magic link (passwordless)
- TOTP 2FA
- Session management (cookie-based with configurable settings)

### Integration Pattern
```typescript
// API server: Hono + Better Auth + Drizzle
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

const auth = betterAuth({
  database: drizzleAdapter(db),
  plugins: [organization()],
  // ... SSO, MFA config
});
```

### Risk Assessment
- Newer library, smaller community than Auth.js
- Not enterprise-audited (no SOC2 report)
- Self-hosted means owning security surface
- Mitigations: Pin versions, monitor CVE databases, consider security audit for Phase 5

---

## 4. Code Sandbox (Phased Approach)

### Firecracker (Phase 4 Target)
- VM-level isolation using KVM
- ~125ms boot time, ~5MB memory overhead per VM
- Requires KVM access (bare metal or nested virt: Hetzner AX-series, AWS `.metal`)
- No network, no GPU, Linux-only guests
- I/O via vsock (not shared filesystem)
- Used by AWS Lambda, Fly.io at massive scale

### nsjail (Phase 1 MVP)
- Google's lightweight sandbox using Linux namespaces + cgroups + seccomp
- No KVM needed, deploys anywhere Linux runs
- Adequate for authenticated users, not for untrusted public code
- 1-2 weeks engineering effort
- Config file for resource limits

### gVisor (Phase 3 Hardening)
- User-space kernel interception (no KVM needed)
- Stronger than nsjail, weaker than Firecracker
- 1 week migration from nsjail
- Good middle ground for broader user access before Phase 4

### Abstract Interface (Day 1)
```typescript
interface SandboxBackend {
  execute(request: {
    code: string;
    language: "python" | "javascript" | "bash";
    timeoutMs: number;    // Default: 30000, Max: 120000
    memoryMB: number;     // Default: 256, Max: 1024
    cpuCores: number;     // Default: 0.5, Max: 2.0
    diskMB: number;       // Default: 100, Max: 512
    networkEnabled: boolean; // Default: false
  }): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    artifacts: Artifact[];
    executionMs: number;
    peakMemoryMB: number;
  }>;
}
// Implementations: NsjailBackend, GVisorBackend, FirecrackerBackend
```

### Default Resource Limits

| Resource | Default | Max (org-configurable) |
|----------|---------|----------------------|
| Timeout | 30 seconds | 120 seconds |
| Memory | 256 MB | 1024 MB |
| CPU | 0.5 cores | 2.0 cores |
| Disk | 100 MB (tmpfs) | 512 MB |
| Network | Disabled | Disabled (always) |

These defaults balance usability with safety. Org admins can increase limits up to the max via settings.

---

## 5. Drizzle ORM

### Key Findings
- Approaching 1.0 release (1.0-beta as of early 2026)
- Native pgvector support via `vector()` column type
- pg_trgm support via raw SQL or custom column types
- drizzle-zod generates Zod schemas from table definitions
- drizzle-kit manages migrations (SQL files, forward-only)
- Works with Bun without issues

### Best Practices
- Review generated migrations manually before applying
- Use `drizzle-zod` for API input validation
- Connection pooling: PgBouncer in production (Drizzle works through PgBouncer)
- Soft deletes via `deleted_at` column + query filters

---

## 6. pgvector for RAG

### Key Findings
- **HNSW vs ivfflat:** Use HNSW -- better recall, no periodic reindexing needed
- **Embedding dimensions:** 1536 (OpenAI text-embedding-3-small) or 768 (smaller models)
- **Hybrid search:** Combine pgvector cosine similarity with pg_trgm text search using RRF (Reciprocal Rank Fusion) or weighted scoring
- **Scale:** Performs well up to ~5M vectors per table; beyond that, consider partitioning by org_id

### Memory Requirements
- HNSW index: ~1.5x the data size in memory
- For 1M vectors at 1536 dimensions: ~6GB index memory
- Use `maintenance_work_mem` setting to control index build memory

### No Dedicated Vector DB Needed Yet
- pgvector handles NOVA's scale (multi-tenant, each org has <100K documents typically)
- Keeps operational complexity low (one database)
- Revisit if a single org exceeds 5M chunks or sub-10ms latency is needed

---

## 7. LiteLLM Model Gateway

### Key Findings
- Apache 2.0 license, self-hosted Docker deployment
- 100+ model providers behind OpenAI-compatible API
- Streaming (SSE), function calling normalization, embeddings API
- Per-user/per-team cost tracking via virtual keys
- Model fallback chains with automatic retry
- Rate limiting (RPM/TPM) per deployment
- ~200-500MB RAM, ~1-5ms latency overhead

### Database Configuration
LiteLLM can optionally use PostgreSQL for spend tracking, request logging, and virtual key management. For NOVA:
- **Recommended:** Point LiteLLM at the NOVA PostgreSQL instance (separate schema/database)
- LiteLLM creates its own tables (`litellm_` prefix)
- This avoids running a third PostgreSQL instance (NOVA DB + Temporal DB is already two)
- Set via `DATABASE_URL` environment variable in Docker Compose

### Configuration
```yaml
# litellm_config.yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      api_base: https://your-resource.openai.azure.com/
      api_key: os.environ/AZURE_API_KEY
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  drop_params: true
  set_verbose: false
  callbacks: ["langfuse"]
```

---

## 8. Frontend Stack

### React 19 + Vite + Tailwind CSS v4
- Tailwind v4 uses `@tailwindcss/vite` plugin (no tailwind.config.js needed)
- CSS-first configuration with `@theme` directive
- Vite provides fast HMR and optimized production builds with Bun

### TanStack Router (over React Router v7)
- Superior TypeScript inference for route params and search params
- Type-safe navigation across the entire app
- Tight TanStack Query integration for data loading
- React Router v7 type safety only works in framework mode (not SPA)

### State Management
- **Zustand** for client-side UI state (~1.2KB gzipped)
- **TanStack Query** for server state (caching, revalidation, optimistic updates)
- **No Redux** -- unnecessary complexity for this use case

### Key Libraries
| Purpose | Library |
|---------|---------|
| Routing | TanStack Router |
| Server state | TanStack Query |
| Client state | Zustand |
| Markdown | react-markdown + rehype-highlight + rehype-katex + remark-mermaid |
| File upload | react-dropzone |
| Forms | TanStack Form or React Hook Form |
| i18n | i18next + react-i18next |
| Icons | Lucide React |
| Date | date-fns |
| WebSocket | Native WebSocket API + reconnecting-websocket |

---

## 9. Observability Stack

### LangFuse (LLM Tracing)
- v3 is OTEL-native (traces via standard OpenTelemetry pipeline)
- LiteLLM has native LangFuse integration
- Self-hosted Docker deployment
- Tracks: token usage, latency, cost, prompt versions, scores

### OpenTelemetry
- OTEL collector receives traces from API, worker, LiteLLM
- Forwards to LangFuse for LLM traces, Prometheus for metrics
- Standard semantic conventions for GenAI operations

### Prometheus + Grafana
- Infrastructure metrics: CPU, memory, request rate, error rate
- Custom metrics: SSE stream count, WebSocket connections, queue depths
- Pre-built Grafana dashboards for PostgreSQL, Redis, MinIO

---

## 10. Bun Workspaces (Monorepo)

### Findings
- Bun supports `workspaces` in package.json natively
- Fast dependency installation with deduplication
- Still evolving: pnpm is more stable for production monorepos
- TypeScript project references ensure proper build order

### Risk Mitigation
- Pin Bun version in CI/CD
- Use `bun.lock` for deterministic installs
- If workspace management proves unstable, migration to pnpm is straightforward

---

## 11. MCP (Model Context Protocol) Integration

### Protocol Status
- MCP TypeScript SDK v1.x is production-ready
- SDK v2 anticipated stable in Q1 2026 with Streamable HTTP transport
- v1.x will receive bug fixes for 6+ months after v2 ships
- Official Hono middleware adapter available

### Transport Mechanisms
| Transport | Use Case | Status |
|-----------|----------|--------|
| stdio | Local MCP servers (same machine) | Stable (v1) |
| Streamable HTTP | Remote MCP servers (network) | New in v2 |
| SSE (legacy) | Deprecated in favor of Streamable HTTP | v1 only |

### NOVA's MCP Architecture

**As an MCP Client:** NOVA connects to external MCP servers on behalf of users/agents.

```
User -> Agent -> NOVA MCP Gateway -> External MCP Server
                     |
                     +-> Tool discovery
                     +-> Auth (OAuth per-user)
                     +-> Rate limiting
                     +-> Audit logging
                     +-> Tenant isolation
```

### Multi-Tenant MCP Implementation Pattern

1. **Per-org server registry:** Each org configures which MCP servers are approved
2. **Per-user authentication:** OAuth tokens are per-user, not per-org
3. **Namespace tools:** Prefix with server name to avoid collisions (e.g., `github.create_issue`)
4. **Lazy connections:** Connect to MCP servers on first use, not at startup
5. **Connection pooling:** Reuse connections per-org with health checks
6. **Session binding:** `<org_id>:<user_id>:<session_id>` prevents cross-tenant access

### MCP Server Registries
- **Official Registry:** registry.modelcontextprotocol.io (preview, vendor-neutral)
- **Smithery:** smithery.ai (community, 2000+ servers)
- **mcp.run:** Hosted registry with sandboxed server execution

### Security Considerations
- MCP servers can execute arbitrary actions -- tool approval modes are critical
- SSRF risk if MCP servers make network requests on behalf of user
- Data exfiltration risk if MCP servers have access to conversation context
- Mitigations: org-level allowlist, admin approval for new servers, audit all tool calls

### Implementation in NOVA
- Phase 3: Basic MCP client (connect by URL, browse tools, test connectivity)
- Phase 3: Org-level MCP server allowlist
- Phase 4: MCP Gateway with connection pooling, auth, audit logging
- Use `@modelcontextprotocol/sdk` TypeScript package (v1.x initially, migrate to v2 when stable)

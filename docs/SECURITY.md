# NOVA -- Security Review

---

## Threat Model

### Actors

| Actor | Access Level | Motivation |
|-------|-------------|-----------|
| Anonymous | Public endpoints only | Account enumeration, brute force, DoS |
| Authenticated user (member) | Own org data | Privilege escalation, cross-org data access, IDOR |
| Org admin | Org-level settings | Over-permissioning, data exfiltration of other users |
| Super-admin | System-wide | Accidental misconfiguration, insider threat |
| External attacker | Network-level | Data breach, service disruption, code execution escape |
| Malicious MCP server | Tool execution | Data exfiltration via tool responses, SSRF |
| Malicious uploaded content | File/URL processing | Prompt injection, XSS via Markdown, SSRF via URL scraping |

### Trust Boundaries

```
Internet <-> Load Balancer <-> API Server <-> Internal Services
                                   |
                                   +-> PostgreSQL (NOVA data)
                                   +-> Redis (sessions, pub/sub)
                                   +-> RustFS (files)
                                   +-> LiteLLM (model gateway)
                                   +-> Temporal (workflows)
                                   +-> Worker -> Code Sandbox
                                   +-> External MCP Servers
```

Critical trust boundaries:
1. **Internet -> API**: All external input enters here
2. **API -> Internal services**: Authenticated, but must validate org scoping
3. **Worker -> Code Sandbox**: Untrusted code execution
4. **API -> External MCP Servers**: Third-party services with unknown security posture
5. **API -> LiteLLM -> LLM Providers**: Prompt content leaves the system

---

## Top Risks & Mitigations

### 1. Prompt Injection

**Risk:** User injects instructions via uploaded files, URLs, or conversation context that manipulate the LLM into executing unintended actions.

**Mitigations:**
- File content injected as tool results, NOT as system context
- System prompts are read-only (users set conversation-level prompts, not system-level)
- Tool calls require explicit approval in `always-ask` mode
- Output validation: scan LLM responses for common injection patterns before rendering
- LangFuse tracing captures full prompt/response pairs for audit

**Phase:** 1 (basic), 4 (content filtering rules)

### 2. SSRF (Server-Side Request Forgery)

**Risk:** URL scraping, webhook calls, or MCP server connections hit internal services.

**Mitigations:**
- Deny all requests to RFC1918 ranges (10.x, 172.16-31.x, 192.168.x), link-local (169.254.x), and localhost
- URL scraping runs in Temporal activity with network-restricted sandbox
- Webhook delivery validates destination against allowlist
- MCP server connections validated against org-level allowlist
- DNS rebinding protection: resolve hostname BEFORE connecting, reject private IPs

**Phase:** 1 (URL validation), 3 (MCP allowlist), 4 (webhook validation)

### 3. Insecure Direct Object Reference (IDOR)

**Risk:** User accesses another org's conversations, files, agents, or knowledge.

**Mitigations:**
- ALL database queries include `WHERE org_id = $currentOrgId` enforced at the service layer
- Drizzle query builder wraps all queries with org scoping middleware
- Integration tests verify cross-org isolation (create data in org A, attempt access from org B)
- File access via RustFS presigned URLs scoped to org-specific bucket prefixes
- API never exposes internal database IDs in URLs; use UUID v7

**Phase:** 1 (core implementation), 2 (integration tests)

### 4. Code Sandbox Escape

**Risk:** Code submitted by users escapes the sandbox and accesses the host system.

**Mitigations (phased):**
- **nsjail (Phase 1-3):** Linux namespaces + cgroups + seccomp. No shared filesystem. Network disabled. Read-only rootfs except /tmp.
- **gVisor (Phase 3):** User-space kernel intercepts all syscalls. Additional isolation layer.
- **Firecracker (Phase 4):** Full VM isolation with KVM. jailer enforces cgroups/seccomp. No shared filesystem. Network disabled. vsock for I/O only. Hard timeout kill.
- All phases: Resource limits (CPU 0.5 core, RAM 256MB, 30s timeout). Output size capped at 10MB. No access to environment variables or secrets.

**Phase:** 1 (nsjail), 3 (gVisor option), 4 (Firecracker)

### 5. Tool / MCP Abuse

**Risk:** Agent calls a destructive tool without user awareness, or MCP server exfiltrates data.

**Mitigations:**
- Tool approval modes per agent: `auto` (trusted tools only), `always-ask` (human approval for every call), `never` (tools disabled)
- Admin can disable specific tools/MCP servers org-wide
- All tool calls logged to `audit_logs` with full request/response
- MCP server connections validated against org-level allowlist
- MCP tool responses are treated as untrusted content (sanitized before display)
- Rate limiting on tool calls per agent per minute

**Phase:** 3 (basic tool approval), 4 (MCP security hardening)

### 6. Session Hijacking

**Risk:** Cookie theft via XSS or network sniffing allows account takeover.

**Mitigations:**
- Cookies: `HttpOnly`, `SameSite=Strict`, `Secure` (HTTPS only)
- Short session TTL (24 hours) with refresh tokens
- Session bound to user-agent and IP range (warn on change, require re-auth on major change)
- Active session list in user profile with revocation
- Anomaly detection: alert on session reuse from significantly different IP/geo

**Phase:** 1 (cookie settings), 2 (session management UI), 4 (anomaly detection)

### 7. Stored XSS via Markdown

**Risk:** Malicious Markdown/HTML in assistant messages or user notes executes in other users' browsers.

**Mitigations:**
- DOMPurify sanitization on ALL rendered Markdown/HTML before DOM insertion
- Strict Content-Security-Policy header: no `unsafe-inline`, no `unsafe-eval`
- No `dangerouslySetInnerHTML` without DOMPurify
- Code blocks rendered with syntax highlighting (no script execution)
- Mermaid diagrams rendered in sandboxed iframe or via DOMPurify-safe SVG
- User-uploaded images served from RustFS with `Content-Disposition: attachment` for non-image types

**Phase:** 1 (DOMPurify + CSP)

### 8. API Key Leakage

**Risk:** Developer API keys committed to repos or leaked via logs.

**Mitigations:**
- API keys are hashed (SHA-256) in database; only shown once on creation
- Keys have configurable expiry and scope (read-only, specific endpoints)
- Revocation endpoint immediately invalidates a key
- Keys are never logged (redacted in request logs and audit trail)
- Webhook for GitHub secret scanning integration

**Phase:** 4 (API key management)

### 9. Mass Assignment

**Risk:** Client sends extra fields in request body that modify unexpected database columns.

**Mitigations:**
- ALL API inputs validated with Zod schemas (generated from Drizzle via drizzle-zod)
- ORM never does `INSERT ... values(req.body)` -- explicit field mapping only
- TypeScript strict mode prevents accidental property forwarding
- `unknown` fields in Zod schemas are stripped (`.strict()` mode)

**Phase:** 1 (Zod validation on all endpoints)

### 10. DDoS / Resource Exhaustion

**Risk:** High-frequency requests, LLM calls, or WebSocket connections exhaust resources.

**Mitigations:**
- Token bucket rate limiting in Redis (per-user, per-IP, per-org)
- Per-org spending limits enforced by LiteLLM virtual keys
- Temporal workflow concurrency limits (max 10 concurrent agent runs per user)
- WebSocket connection limit per user (max 5 concurrent connections)
- SSE stream count monitored with alerts at threshold
- API server request body size limit (10MB for file uploads, 1MB for other requests)

**Phase:** 1 (rate limiting), 2 (spending limits), 3 (workflow concurrency)

---

## Audit Logging

Every state-changing action writes an `audit_logs` row:

```sql
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organisations(id),
    actor_id UUID REFERENCES users(id),  -- NULL for system actions
    actor_type TEXT NOT NULL,             -- 'user', 'system', 'api_key', 'agent'
    impersonator_id UUID REFERENCES users(id), -- set when admin impersonates (story #23)
    action TEXT NOT NULL,          -- e.g., 'conversation.create', 'agent.tool_call'
    resource_type TEXT NOT NULL,   -- e.g., 'conversation', 'agent', 'file'
    resource_id UUID,
    details JSONB,                 -- context: before/after state, tool call params, etc.
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

> **Note:** The canonical schema is in `docs/DOMAIN_MODEL.md`. This snippet matches that definition.

### Audit Actions (non-exhaustive)

| Action | Resource Type | When |
|--------|-------------|------|
| `auth.login` | user | User logs in |
| `auth.logout` | user | User logs out |
| `auth.login_failed` | user | Failed login attempt |
| `auth.mfa_enabled` | user | User enables MFA |
| `user.created` | user | User account created |
| `user.deactivated` | user | Admin deactivates user |
| `user.impersonated` | user | Admin impersonates user |
| `conversation.created` | conversation | New conversation |
| `conversation.shared` | conversation | Conversation shared |
| `conversation.deleted` | conversation | Conversation deleted |
| `message.created` | message | New message sent |
| `message.edited` | message | Message edited |
| `agent.tool_call` | tool_call | Agent invokes a tool |
| `agent.tool_approved` | tool_call | User approves tool call |
| `agent.tool_rejected` | tool_call | User rejects tool call |
| `file.uploaded` | file | File uploaded |
| `file.deleted` | file | File deleted |
| `apikey.created` | api_key | API key created |
| `apikey.revoked` | api_key | API key revoked |
| `org.setting_changed` | org_setting | Org setting modified |
| `admin.user_invited` | user | Admin invites user |
| `sandbox.executed` | sandbox | Code executed in sandbox |

### Retention
- Default: 90 days
- Configurable per-org (admin setting)
- Archived to RustFS as compressed JSON after retention period
- GDPR deletion: anonymize actor_id but preserve action records

---

## Data Classification

| Classification | Examples | Storage | Access |
|---------------|---------|---------|--------|
| **Critical** | Passwords, API keys, OAuth tokens | Hashed/encrypted in PostgreSQL | Never logged, never exposed in API |
| **Sensitive** | Conversation content, file contents, agent memory | PostgreSQL + RustFS (encrypted at rest) | Org-scoped, user-authorized |
| **Internal** | Audit logs, usage stats, system config | PostgreSQL | Admin-only |
| **Public** | Shared conversation links, public agent listings | PostgreSQL | Read-only, expiring tokens |

---

## Encryption

### At Rest
- PostgreSQL: Full-disk encryption on the volume (LUKS or cloud-provider encryption)
- RustFS: Server-side encryption (SSE-S3) enabled by default
- Redis: Not encrypted at rest (acceptable for ephemeral cache/session data)
- Backups: Encrypted with AES-256 before upload to backup storage

### In Transit
- All external connections: TLS 1.3+ (enforced by ingress/load balancer)
- Internal service-to-service: TLS recommended in production (optional in dev Docker Compose)
- WebSocket: WSS (TLS) required in production
- Database connections: SSL mode `require` in production

---

## Security Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.minio.local; connect-src 'self' wss://*; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (deprecated, rely on CSP)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(self), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## Compliance Checklist

| Requirement | Status | Phase |
|------------|--------|-------|
| OWASP Top 10 coverage | All 10 addressed in this document | 1-4 |
| Audit logging | Comprehensive (see above) | 1 |
| Data encryption at rest | PostgreSQL + RustFS encryption | 1 |
| Data encryption in transit | TLS 1.3+ | 1 |
| GDPR data export | User data export endpoint | 5 |
| GDPR right to deletion | Anonymization workflow | 5 |
| Session management | Better Auth + Redis sessions | 1 |
| Rate limiting | Redis token bucket | 1 |
| Input validation | Zod schemas on all endpoints | 1 |
| Output sanitization | DOMPurify + CSP | 1 |
| Security headers | Full set (see above) | 1 |
| Dependency scanning | GitHub Dependabot + `bun audit` | 1 |
| Container scanning | Trivy in CI pipeline | 2 |
| Penetration testing | External pentest before SaaS launch | 5 |

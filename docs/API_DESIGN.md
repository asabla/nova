# NOVA -- API Design

> Version: 1.0
> Date: 2026-03-06
> Status: Complete -- covers all 234 user stories

---

## 1. API Conventions

| Convention | Rule |
|---|---|
| Base URL | `/api/v1/` for all REST endpoints |
| Auth routes | `/api/auth/` (Better Auth managed, no version prefix) |
| Versioning | URL path versioning (`/api/v1/`, `/api/v2/` when needed) |
| Authentication | Bearer token via `Authorization: Bearer <token>` header OR session cookie (Better Auth `__session`) OR API key via `X-API-Key` header |
| Content-Type | `application/json` for all request/response bodies unless otherwise noted |
| IDs | UUID v7 (time-sortable) |
| Timestamps | ISO 8601 with timezone (`2026-03-06T14:30:00.000Z`) |
| Soft delete | DELETE endpoints set `deleted_at`; response returns `204 No Content` |
| Org scoping | All org-scoped endpoints derive `org_id` from the authenticated session; never passed as a body field |
| Pagination | Cursor-based: `?cursor=<uuid>&limit=<int>` (default limit 25, max 100) |
| Sorting | `?sort=created_at&order=desc` (default `created_at desc`) |
| Filtering | Resource-specific query params (documented per endpoint) |
| Search | `?q=<term>` for text search where supported |

### Error Response Format (RFC 7807)

All errors use the Problem Details format:

```json
{
  "type": "https://nova.app/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Conversation with ID 01912345-abcd-7000-8000-000000000000 not found.",
  "instance": "/api/v1/conversations/01912345-abcd-7000-8000-000000000000",
  "traceId": "abc123"
}
```

Validation errors include a `errors` array:

```json
{
  "type": "https://nova.app/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request body failed validation.",
  "errors": [
    { "field": "name", "message": "Required", "code": "required" },
    { "field": "email", "message": "Invalid email format", "code": "invalid_email" }
  ]
}
```

### Rate Limiting Headers

All responses include:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds until retry (only on `429` responses) |

### Pagination Response Envelope

```json
{
  "data": [...],
  "pagination": {
    "cursor": "01912345-abcd-7000-8000-000000000001",
    "hasMore": true,
    "total": 142
  }
}
```

Single-resource responses return the object directly (no envelope).

### Role Abbreviations

Used in the **Auth** column throughout this document:

| Abbr | Meaning |
|---|---|
| `public` | No authentication required |
| `authed` | Any authenticated user (member+) |
| `power` | power-user, org-admin, or super-admin |
| `org-admin` | org-admin or super-admin |
| `super` | super-admin only |

---

## 2. Auth Endpoints (Better Auth)

Better Auth manages these routes. NOVA mounts them at `/api/auth/`. Request/response schemas follow Better Auth conventions.

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/auth/sign-up/email` | public | Register with email + password | 1 |
| POST | `/api/auth/sign-in/email` | public | Login with email + password; returns session cookie | 1 |
| POST | `/api/auth/sign-out` | authed | Invalidate current session | 1 |
| POST | `/api/auth/magic-link` | public | Send magic link to email | 5 |
| GET | `/api/auth/magic-link/verify` | public | Verify magic link token (`?token=...`) | 5 |
| GET | `/api/auth/callback/:provider` | public | OAuth callback (Azure AD, Google, GitHub, GitLab) | 2, 3, 4 |
| POST | `/api/auth/mfa/setup` | authed | Begin TOTP setup; returns QR code URI | 7 |
| POST | `/api/auth/mfa/verify` | authed | Verify TOTP code to complete setup or authenticate | 7 |
| POST | `/api/auth/mfa/disable` | authed | Disable MFA (requires current TOTP code) | 7 |
| GET | `/api/auth/sessions` | authed | List active sessions for current user | 8 |
| DELETE | `/api/auth/sessions/:id` | authed | Revoke a specific session | 8 |
| POST | `/api/auth/forgot-password` | public | Send password reset email | 1 |
| POST | `/api/auth/reset-password` | public | Reset password with token | 1 |
| GET | `/api/auth/session` | authed | Get current session + user info | 1 |

### SSO Configuration (Admin)

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/sso-providers` | org-admin | List configured SSO providers | 2, 3, 4 |
| POST | `/api/v1/sso-providers` | org-admin | Configure a new SSO provider | 2, 3, 4 |
| PATCH | `/api/v1/sso-providers/:id` | org-admin | Update SSO provider config | 2, 3, 4 |
| DELETE | `/api/v1/sso-providers/:id` | org-admin | Remove SSO provider | 2, 3, 4 |

**Request (POST/PATCH):** `SsoProviderCreateSchema` / `SsoProviderUpdateSchema`
```
{ type, provider_name, client_id, client_secret, issuer_url?, metadata_url?, is_enabled?, auto_provision_users?, default_role? }
```

---

## 3. REST Endpoints

### 3.1 Organisations

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/orgs` | super | List all organisations | 11, 15 |
| POST | `/api/v1/orgs` | super | Create organisation | 11 |
| GET | `/api/v1/orgs/current` | authed | Get current user's org | 12 |
| PATCH | `/api/v1/orgs/current` | org-admin | Update org settings (name, logo, domain, colors, CSS) | 12, 13, 207, 208, 210 |
| DELETE | `/api/v1/orgs/:id` | super | Soft-delete organisation | 11 |
| GET | `/api/v1/orgs/current/settings` | org-admin | Get all org settings | 12 |
| PATCH | `/api/v1/orgs/current/settings` | org-admin | Update org settings (key-value pairs) | 9, 69, 70, 75, 121, 178 |
| GET | `/api/v1/orgs/current/billing` | org-admin | Get billing info (SaaS mode) | 16 |
| PATCH | `/api/v1/orgs/current/billing` | org-admin | Update billing plan / payment method | 16 |

**Request (POST org):** `OrgCreateSchema` -- `{ name, slug, domain?, is_saas? }`
**Request (PATCH org):** `OrgUpdateSchema` -- `{ name?, slug?, domain?, logo_url?, favicon_url?, primary_color?, custom_css? }`
**Request (PATCH settings):** `OrgSettingsUpdateSchema` -- `{ key: string, value: any }[]`
**Response:** `Organisation` object with nested `settings` when requested via `?include=settings`

---

### 3.2 Users & Profiles

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/users` | org-admin | List users in current org (filter: `?q=`, `?role=`, `?group_id=`, `?is_active=`) | 19 |
| POST | `/api/v1/users/invite` | org-admin | Invite user by email | 20 |
| POST | `/api/v1/users/invite/bulk` | org-admin | Bulk invite from CSV upload | 21 |
| GET | `/api/v1/users/:id` | org-admin | Get user detail | 19 |
| PATCH | `/api/v1/users/:id` | org-admin | Update user role, active status | 19, 22 |
| POST | `/api/v1/users/:id/deactivate` | org-admin | Deactivate user (preserves data) | 22 |
| POST | `/api/v1/users/:id/reactivate` | org-admin | Reactivate user | 22 |
| POST | `/api/v1/users/:id/impersonate` | org-admin | Start impersonation session (audit logged) | 23 |
| GET | `/api/v1/users/me` | authed | Get current user profile | 24 |
| PATCH | `/api/v1/users/me` | authed | Update own profile (name, avatar, timezone, locale, theme, font_size) | 24, 167, 168, 209 |
| GET | `/api/v1/users/me/usage` | authed | Get personal usage dashboard | 157 |
| GET | `/api/v1/users/me/storage` | authed | Get personal storage usage vs quota | 68 |

**Request (invite):** `InviteUserSchema` -- `{ email, role?, group_ids? }`
**Request (bulk invite):** `multipart/form-data` with CSV file
**Request (PATCH me):** `UserProfileUpdateSchema` -- `{ display_name?, avatar_url?, timezone?, locale?, theme?, font_size? }`

---

### 3.3 Groups

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/groups` | org-admin | List groups | 17 |
| POST | `/api/v1/groups` | org-admin | Create group | 17 |
| GET | `/api/v1/groups/:id` | org-admin | Get group detail | 17 |
| PATCH | `/api/v1/groups/:id` | org-admin | Update group (name, quotas, model access, retention) | 17, 25, 26, 28, 69 |
| DELETE | `/api/v1/groups/:id` | org-admin | Soft-delete group | 17 |
| GET | `/api/v1/groups/:id/members` | org-admin | List group members | 17 |
| POST | `/api/v1/groups/:id/members` | org-admin | Add user(s) to group | 17, 18 |
| DELETE | `/api/v1/groups/:id/members/:userId` | org-admin | Remove user from group | 17 |
| POST | `/api/v1/groups/:id/sync-sso` | org-admin | Sync group membership from SSO provider | 18 |
| GET | `/api/v1/groups/:id/usage` | org-admin | Get usage stats for group | 27, 155 |

**Request (POST/PATCH group):** `GroupCreateSchema` / `GroupUpdateSchema`
```
{ name, description?, sso_group_id?, model_access?, monthly_token_limit?, monthly_cost_limit_cents?, storage_quota_mb?, data_retention_days? }
```

---

### 3.4 Conversations

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/conversations` | authed | List user's conversations (filter: `?workspace_id=`, `?folder_id=`, `?tag_id=`, `?is_pinned=`, `?is_archived=`, `?model_id=`, `?from=`, `?to=`, `?q=`) | 29, 34, 226 |
| POST | `/api/v1/conversations` | authed | Create conversation | 29 |
| GET | `/api/v1/conversations/:id` | authed | Get conversation with participants and model config | 29 |
| PATCH | `/api/v1/conversations/:id` | authed | Update title, visibility, system prompt, model params, pin, archive | 36, 37, 32, 40, 48, 49 |
| DELETE | `/api/v1/conversations/:id` | authed | Soft-delete conversation (owner or admin) | 33 |
| POST | `/api/v1/conversations/:id/fork` | authed | Fork at a specified message ID | 35 |
| POST | `/api/v1/conversations/:id/share` | authed | Share with users (adds participants) | 30, 31 |
| POST | `/api/v1/conversations/:id/share/public` | authed | Generate public share link | 39 |
| DELETE | `/api/v1/conversations/:id/share/public` | authed | Revoke public share link | 39 |
| GET | `/api/v1/conversations/shared/:token` | public | View public shared conversation (read-only) | 39 |
| GET | `/api/v1/conversations/:id/export` | authed | Export as Markdown, PDF, or JSON (`?format=md|pdf|json`) | 38 |
| GET | `/api/v1/conversations/:id/participants` | authed | List participants | 31 |
| POST | `/api/v1/conversations/:id/participants` | authed | Add participant | 31, 45 |
| DELETE | `/api/v1/conversations/:id/participants/:userId` | authed | Remove participant | 31 |
| POST | `/api/v1/conversations/bulk` | authed | Bulk archive/delete/move conversations | 225 |
| GET | `/api/v1/conversations/:id/cost` | authed | Get token count and cost summary | 50 |

**Request (POST conversation):** `ConversationCreateSchema`
```
{ workspace_id?, title?, model_id?, system_prompt?, model_params?, visibility? }
```
**Request (fork):** `{ from_message_id: uuid }`
**Request (share):** `{ user_ids: uuid[], role?: "participant" | "viewer" }`
**Request (bulk):** `{ action: "archive" | "delete" | "move", conversation_ids: uuid[], folder_id?: uuid }`

---

### 3.5 Conversation Folders & Tags

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/conversation-folders` | authed | List user's folders (tree structure) | 224 |
| POST | `/api/v1/conversation-folders` | authed | Create folder | 224 |
| PATCH | `/api/v1/conversation-folders/:id` | authed | Update folder (name, parent, sort order) | 224 |
| DELETE | `/api/v1/conversation-folders/:id` | authed | Delete folder | 224 |
| GET | `/api/v1/conversation-tags` | authed | List user's tags | 224 |
| POST | `/api/v1/conversation-tags` | authed | Create tag | 224 |
| PATCH | `/api/v1/conversation-tags/:id` | authed | Update tag (name, color) | 224 |
| DELETE | `/api/v1/conversation-tags/:id` | authed | Delete tag | 224 |
| POST | `/api/v1/conversations/:id/tags` | authed | Assign tags to conversation | 224 |
| DELETE | `/api/v1/conversations/:id/tags/:tagId` | authed | Remove tag from conversation | 224 |
| POST | `/api/v1/conversations/:id/folder` | authed | Move conversation to folder | 224 |

---

### 3.6 Messages

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/conversations/:id/messages` | authed | List messages (paginated, chronological) | 29 |
| POST | `/api/v1/conversations/:id/messages` | authed | Send a message (triggers LLM response via SSE) | 29, 60, 71 |
| PATCH | `/api/v1/conversations/:convId/messages/:msgId` | authed | Edit message content (stores edit history) | 42, 231 |
| POST | `/api/v1/conversations/:convId/messages/:msgId/replay` | authed | Re-run from this message with a different model | 41 |
| POST | `/api/v1/conversations/:convId/messages/:msgId/retry` | authed | Retry a failed message | 56, 196 |
| POST | `/api/v1/conversations/:convId/messages/:msgId/stop` | authed | Stop a streaming/running response | 51, 52 |
| POST | `/api/v1/conversations/:convId/messages/:msgId/rate` | authed | Rate message (thumbs up/down + optional feedback) | 43 |
| GET | `/api/v1/conversations/:convId/messages/:msgId/notes` | authed | List notes on a message | 44 |
| POST | `/api/v1/conversations/:convId/messages/:msgId/notes` | authed | Add private note to message | 44 |
| PATCH | `/api/v1/conversations/:convId/messages/:msgId/notes/:noteId` | authed | Update note | 44 |
| DELETE | `/api/v1/conversations/:convId/messages/:msgId/notes/:noteId` | authed | Delete note | 44 |
| GET | `/api/v1/conversations/:convId/messages/:msgId/tool-calls` | authed | List tool calls for a message | 55, 58 |
| POST | `/api/v1/conversations/:convId/messages/:msgId/tool-calls/:callId/approve` | authed | Approve pending tool call (human-in-the-loop) | 54 |
| POST | `/api/v1/conversations/:convId/messages/:msgId/tool-calls/:callId/reject` | authed | Reject pending tool call | 54 |

**Request (POST message):** `MessageCreateSchema`
```
{ content: string, content_type?: "text" | "image" | "audio", agent_id?: uuid, model_id?: uuid, attachment_ids?: uuid[], urls?: string[] }
```
**Request (rate):** `{ rating: 1 | -1, feedback?: string }`
**Request (replay):** `{ model_id: uuid }`

---

### 3.7 Files

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/files` | authed | List user's files (filter: `?workspace_id=`, `?content_type=`, `?q=`) | 60 |
| POST | `/api/v1/files/upload` | authed | Upload file(s) (`multipart/form-data`, max 10 files) | 60, 61, 66, 67 |
| POST | `/api/v1/files/upload/presigned` | authed | Get presigned upload URL for large files | 60 |
| GET | `/api/v1/files/:id` | authed | Get file metadata | 60 |
| GET | `/api/v1/files/:id/download` | authed | Get presigned download URL (redirects or returns URL) | 60 |
| GET | `/api/v1/files/:id/preview` | authed | Get inline preview (images, PDFs) | 64 |
| DELETE | `/api/v1/files/:id` | authed | Soft-delete file (owner or admin) | 62 |
| POST | `/api/v1/files/:id/save` | authed | Save an artifact to file library | 139 |
| GET | `/api/v1/files/admin` | org-admin | List all files in org (admin view) | 62 |
| DELETE | `/api/v1/files/admin/:id` | org-admin | Admin delete any file | 62 |
| GET | `/api/v1/files/quotas` | org-admin | Get org-wide file quota settings | 69, 70 |
| PATCH | `/api/v1/files/quotas` | org-admin | Update file quota settings (types, max size, per-user quota) | 69, 70 |

**Upload constraints:**
- Max file size: configurable per org (default 50MB, max 500MB)
- Allowed types: configurable per org (default: PDF, DOCX, XLSX, CSV, TXT, MD, PPTX, code files, images, audio, video)
- Stories: 63, 70

---

### 3.8 Knowledge Collections

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/knowledge-collections` | authed | List accessible collections (filter: `?visibility=`, `?status=`, `?q=`) | 114 |
| POST | `/api/v1/knowledge-collections` | power | Create collection | 114 |
| GET | `/api/v1/knowledge-collections/:id` | authed | Get collection detail with stats | 114 |
| PATCH | `/api/v1/knowledge-collections/:id` | power | Update collection (name, visibility, chunking config) | 114, 121 |
| DELETE | `/api/v1/knowledge-collections/:id` | power | Soft-delete collection | 114 |
| GET | `/api/v1/knowledge-collections/:id/documents` | authed | List documents in collection | 114 |
| POST | `/api/v1/knowledge-collections/:id/documents` | power | Add document(s) -- file IDs or URLs | 114, 116 |
| DELETE | `/api/v1/knowledge-collections/:id/documents/:docId` | power | Remove document from collection | 114 |
| POST | `/api/v1/knowledge-collections/:id/reindex` | power | Trigger re-indexing (Temporal workflow) | 117 |
| POST | `/api/v1/knowledge-collections/:id/query` | authed | Test query against collection (returns matching chunks with scores) | 118, 119 |
| POST | `/api/v1/knowledge-collections/:id/share` | power | Share collection with users/groups | 115 |
| GET | `/api/v1/knowledge-collections/:id/versions` | authed | List version history | 232 |
| PATCH | `/api/v1/knowledge-collections/admin/embedding-model` | org-admin | Set org-wide default embedding model | 120 |

**Request (POST collection):** `KnowledgeCollectionCreateSchema`
```
{ name, description?, visibility?, embedding_model_id?, chunk_size?, chunk_overlap? }
```
**Request (query):** `{ query: string, top_k?: number }` -- returns `{ chunks: [{ content, score, document_title, metadata }] }`

---

### 3.9 Agents

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/agents` | authed | List accessible agents (filter: `?visibility=`, `?is_published=`, `?q=`, `?owner_id=`) | 91 |
| POST | `/api/v1/agents` | power | Create agent | 91 |
| GET | `/api/v1/agents/:id` | authed | Get agent detail (includes skills, tools, MCP servers) | 91 |
| PATCH | `/api/v1/agents/:id` | power | Update agent config | 91 |
| DELETE | `/api/v1/agents/:id` | power | Soft-delete agent | 91 |
| POST | `/api/v1/agents/:id/clone` | power | Clone agent as a starting point | 104 |
| POST | `/api/v1/agents/:id/publish` | power | Publish agent (to team/org/public) | 98 |
| POST | `/api/v1/agents/:id/unpublish` | power | Unpublish agent | 98 |
| POST | `/api/v1/agents/:id/test` | power | Test agent with sample prompt(s) | 100 |
| GET | `/api/v1/agents/:id/versions` | authed | List agent versions | 99 |
| GET | `/api/v1/agents/:id/versions/:version` | authed | Get specific version detail | 99 |
| POST | `/api/v1/agents/:id/versions` | power | Create new version snapshot | 99 |
| GET | `/api/v1/agents/:id/skills` | authed | List agent skills | 93 |
| POST | `/api/v1/agents/:id/skills` | power | Attach skill to agent | 93 |
| DELETE | `/api/v1/agents/:id/skills/:skillId` | power | Detach skill | 93 |
| GET | `/api/v1/agents/:id/tools` | authed | List agent tools | 94 |
| POST | `/api/v1/agents/:id/tools` | power | Attach tool to agent | 94 |
| DELETE | `/api/v1/agents/:id/tools/:toolId` | power | Detach tool | 94 |
| GET | `/api/v1/agents/:id/mcp-servers` | authed | List agent MCP servers | 95 |
| POST | `/api/v1/agents/:id/mcp-servers` | power | Attach MCP server to agent | 95 |
| DELETE | `/api/v1/agents/:id/mcp-servers/:mcpServerId` | power | Detach MCP server | 95 |
| GET | `/api/v1/agents/:id/knowledge` | authed | List attached knowledge collections | 114 |
| POST | `/api/v1/agents/:id/knowledge` | power | Attach knowledge collection | 114 |
| DELETE | `/api/v1/agents/:id/knowledge/:collectionId` | power | Detach knowledge collection | 114 |
| PATCH | `/api/v1/agents/:id/schedule` | power | Set/update cron schedule | 107 |
| DELETE | `/api/v1/agents/:id/schedule` | power | Remove cron schedule | 107 |
| POST | `/api/v1/agents/admin/bulk` | org-admin | Bulk enable/disable/reassign agents | 234 |

**Request (POST agent):** `AgentCreateSchema`
```
{ name, description?, system_prompt?, model_id?, model_params?, visibility?, tool_approval_mode?, memory_scope?, max_steps?, timeout_seconds? }
```
**Request (test):** `{ prompts: string[], model_id?: uuid }`
**Response (test):** `{ results: [{ prompt, response, tokens_used, latency_ms }] }`

---

### 3.10 Agent Memory

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/agents/:agentId/memory` | authed | List memory entries (filter: `?scope=`, `?key=`, `?q=`) | 109, 110 |
| POST | `/api/v1/agents/:agentId/memory` | power | Create memory entry | 109 |
| GET | `/api/v1/agents/:agentId/memory/:id` | authed | Get memory entry | 110 |
| PATCH | `/api/v1/agents/:agentId/memory/:id` | authed | Update memory entry | 110 |
| DELETE | `/api/v1/agents/:agentId/memory/:id` | authed | Delete memory entry | 111 |
| POST | `/api/v1/agents/:agentId/memory/export` | power | Export all memory as JSON | 112 |
| POST | `/api/v1/agents/:agentId/memory/import` | power | Import memory from JSON | 112 |
| DELETE | `/api/v1/agents/:agentId/memory` | power | Clear all memory for agent (filter: `?scope=`) | 111 |

**Request (POST/PATCH):** `AgentMemoryEntrySchema` -- `{ key, value, scope?, user_id?, conversation_id? }`
**Size limits:** Configurable per agent (story 113), enforced server-side.

---

### 3.11 Tools

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/tools` | authed | List tools (filter: `?type=`, `?is_approved=`, `?q=`) | 144, 145 |
| POST | `/api/v1/tools` | power | Register a custom tool (via OpenAPI spec or function schema) | 146 |
| GET | `/api/v1/tools/:id` | authed | Get tool detail | 144 |
| PATCH | `/api/v1/tools/:id` | power | Update tool | 146 |
| DELETE | `/api/v1/tools/:id` | power | Soft-delete tool | 146 |
| POST | `/api/v1/tools/:id/approve` | org-admin | Approve tool for org-wide use | 148 |
| POST | `/api/v1/tools/:id/revoke` | org-admin | Revoke approval | 148 |
| POST | `/api/v1/tools/:id/test` | power | Test tool with sample input | 147 |
| GET | `/api/v1/tools/:id/versions` | authed | List tool versions | 146 |
| POST | `/api/v1/tools/:id/disable` | org-admin | Disable tool org-wide | 103 |
| POST | `/api/v1/tools/:id/enable` | org-admin | Re-enable tool org-wide | 103 |

**Request (POST tool):** `ToolCreateSchema`
```
{ name, description?, type: "openapi" | "custom", openapi_spec?, function_schema }
```
**Request (test):** `{ input: object }` -- returns `{ output: object, duration_ms: number }`

---

### 3.12 MCP Servers

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/mcp-servers` | authed | List registered MCP servers | 149 |
| POST | `/api/v1/mcp-servers` | power | Register MCP server by URL | 150 |
| GET | `/api/v1/mcp-servers/:id` | authed | Get MCP server detail (includes health status) | 149 |
| PATCH | `/api/v1/mcp-servers/:id` | power | Update MCP server config | 150 |
| DELETE | `/api/v1/mcp-servers/:id` | power | Soft-delete MCP server | 150 |
| POST | `/api/v1/mcp-servers/:id/approve` | org-admin | Approve MCP server for org-wide use | 152 |
| POST | `/api/v1/mcp-servers/:id/revoke` | org-admin | Revoke approval | 152 |
| POST | `/api/v1/mcp-servers/:id/test` | power | Test connectivity and list available tools | 153 |
| GET | `/api/v1/mcp-servers/:id/tools` | authed | Browse tools from connected MCP server | 151 |
| POST | `/api/v1/mcp-servers/:id/tools/:toolName/test` | power | Test specific MCP tool with sample input | 153 |
| POST | `/api/v1/mcp-servers/:id/disable` | org-admin | Disable MCP server org-wide | 103 |
| POST | `/api/v1/mcp-servers/:id/enable` | org-admin | Re-enable MCP server org-wide | 103 |

**Request (POST):** `McpServerCreateSchema`
```
{ name, url, description?, auth_type?: "none" | "bearer" | "api_key", auth_token? }
```
**Response (test):** `{ status: "healthy" | "degraded" | "down", response_time_ms, tools: [{ name, description, input_schema }] }`

---

### 3.13 Prompt Templates

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/prompt-templates` | authed | List templates (filter: `?visibility=`, `?category=`, `?tag=`, `?is_approved=`, `?q=`) | 180 |
| POST | `/api/v1/prompt-templates` | authed | Create template | 179 |
| GET | `/api/v1/prompt-templates/:id` | authed | Get template detail | 179 |
| PATCH | `/api/v1/prompt-templates/:id` | authed | Update template | 179 |
| DELETE | `/api/v1/prompt-templates/:id` | authed | Soft-delete template (owner or admin) | 179 |
| POST | `/api/v1/prompt-templates/:id/fork` | authed | Fork a template | 183 |
| GET | `/api/v1/prompt-templates/:id/versions` | authed | List version history | 184 |
| POST | `/api/v1/prompt-templates/:id/versions` | authed | Create new version | 184 |
| POST | `/api/v1/prompt-templates/:id/rate` | authed | Rate a template (1-5 stars + comment) | 186 |
| POST | `/api/v1/prompt-templates/:id/approve` | org-admin | Approve template for org library | 181 |
| POST | `/api/v1/prompt-templates/:id/revoke` | org-admin | Revoke approval | 181 |

**Request (POST):** `PromptTemplateCreateSchema`
```
{ name, description?, content, variables?, system_prompt?, first_message?, category?, tags?, visibility? }
```
**Request (rate):** `{ rating: 1..5, comment?: string }`

---

### 3.14 Workspaces

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/workspaces` | authed | List user's workspaces (filter: `?is_archived=`, `?q=`) | 122 |
| POST | `/api/v1/workspaces` | authed | Create workspace | 122 |
| GET | `/api/v1/workspaces/:id` | authed | Get workspace detail | 122 |
| PATCH | `/api/v1/workspaces/:id` | authed | Update workspace (name, defaults, archive) | 126, 127 |
| DELETE | `/api/v1/workspaces/:id` | authed | Soft-delete workspace (owner or admin) | 122 |
| GET | `/api/v1/workspaces/:id/members` | authed | List workspace members | 125 |
| POST | `/api/v1/workspaces/:id/members` | authed | Add member (user or group) | 125, 128 |
| PATCH | `/api/v1/workspaces/:id/members/:membershipId` | authed | Update member role | 125 |
| DELETE | `/api/v1/workspaces/:id/members/:membershipId` | authed | Remove member | 125 |
| GET | `/api/v1/workspaces/:id/activity` | authed | Get activity feed | 129 |
| GET | `/api/v1/workspaces/:id/conversations` | authed | List conversations in workspace | 124 |
| GET | `/api/v1/workspaces/:id/files` | authed | List files in workspace | 123 |
| POST | `/api/v1/workspaces/:id/files` | authed | Upload files to workspace | 123 |

**Request (POST workspace):** `WorkspaceCreateSchema`
```
{ name, description?, default_agent_id?, default_model_id?, default_system_prompt? }
```
**Request (add member):** `{ user_id?: uuid, group_id?: uuid, role?: "admin" | "member" | "viewer" }`

---

### 3.15 Notifications

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | authed | List notifications (filter: `?is_read=`, `?type=`) | 161 |
| POST | `/api/v1/notifications/mark-read` | authed | Mark notification(s) as read | 161 |
| POST | `/api/v1/notifications/mark-all-read` | authed | Mark all as read | 161 |
| DELETE | `/api/v1/notifications/:id` | authed | Delete notification | 161 |
| GET | `/api/v1/notifications/preferences` | authed | Get notification preferences | 163 |
| PUT | `/api/v1/notifications/preferences` | authed | Update notification preferences | 163 |

**Request (mark-read):** `{ notification_ids: uuid[] }`
**Request (preferences):** `NotificationPreferencesSchema`
```
[{ notification_type: string, channel: "in_app" | "email" | "webhook" | "slack", is_enabled: boolean }]
```

---

### 3.16 Analytics & Usage

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/analytics/usage` | org-admin | Aggregated usage stats (filter: `?user_id=`, `?group_id=`, `?model_id=`, `?period=hourly|daily|monthly`, `?from=`, `?to=`) | 154, 155 |
| GET | `/api/v1/analytics/usage/export` | org-admin | Export usage data as CSV | 158 |
| GET | `/api/v1/analytics/cost` | org-admin | Cost breakdown by model, user, group | 155 |
| GET | `/api/v1/analytics/models` | org-admin | Model latency, error rate, request count | 89 |
| GET | `/api/v1/analytics/budget-alerts` | org-admin | List budget alert configurations | 156 |
| POST | `/api/v1/analytics/budget-alerts` | org-admin | Create budget alert | 156 |
| PATCH | `/api/v1/analytics/budget-alerts/:id` | org-admin | Update budget alert | 156 |
| DELETE | `/api/v1/analytics/budget-alerts/:id` | org-admin | Delete budget alert | 156 |
| GET | `/api/v1/analytics/traces` | org-admin | List agent run traces (links to LangFuse) | 159 |
| GET | `/api/v1/analytics/traces/:workflowId` | org-admin | Get trace detail for a workflow run | 159 |

---

### 3.17 Audit Logs

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/audit-logs` | org-admin | List audit logs (filter: `?actor_id=`, `?action=`, `?resource_type=`, `?resource_id=`, `?from=`, `?to=`, `?ip_address=`) | 10, 171 |
| GET | `/api/v1/audit-logs/:id` | org-admin | Get audit log entry detail | 171 |
| GET | `/api/v1/audit-logs/export` | org-admin | Export audit logs as CSV | 171 |

**Note:** Audit logs are immutable -- no create/update/delete endpoints. They are written automatically by the API server middleware.

---

### 3.18 Admin & System Health

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/admin/health` | org-admin | System health dashboard (PostgreSQL, Redis, MinIO, LiteLLM, Temporal status) | 204 |
| POST | `/api/v1/admin/diagnostics` | org-admin | Run diagnostic check on all external services | 205 |
| GET | `/api/v1/admin/version` | org-admin | Get system version and last update time | 206 |
| GET | `/api/v1/admin/settings` | super | Get system-wide settings | 203 |
| PATCH | `/api/v1/admin/settings` | super | Update system-wide settings | 203 |
| POST | `/api/v1/admin/setup` | super | Complete setup wizard (first-time) | 203 |
| GET | `/api/v1/admin/status` | public | Lightweight health check (`200 OK` or `503`) | 199, 204 |

**Response (health):**
```json
{
  "services": [
    { "name": "postgresql", "status": "healthy", "response_time_ms": 2, "version": "16.4" },
    { "name": "redis", "status": "healthy", "response_time_ms": 1, "version": "7.2.4" },
    { "name": "minio", "status": "healthy", "response_time_ms": 5 },
    { "name": "litellm", "status": "healthy", "response_time_ms": 12 },
    { "name": "temporal", "status": "healthy", "response_time_ms": 8 }
  ],
  "overall": "healthy"
}
```

---

### 3.19 Search

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/search` | authed | Unified semantic + keyword search across conversations, files, agents, knowledge collections | 211, 212 |
| POST | `/api/v1/search/conversations` | authed | Search conversations only | 34, 211 |
| POST | `/api/v1/search/files` | authed | Search files only | 212 |
| POST | `/api/v1/search/agents` | authed | Search agents only | 212 |

**Request:** `SearchQuerySchema`
```
{
  query: string,
  types?: ("conversation" | "file" | "agent" | "knowledge_collection")[],
  filters?: {
    from?: string,        // ISO date
    to?: string,          // ISO date
    model_id?: uuid,
    workspace_id?: uuid,
    participant_ids?: uuid[]
  },
  limit?: number,         // default 20
  cursor?: string
}
```
**Response:** `{ results: [{ type, id, title, snippet, highlights, score, created_at }], pagination }`

Stories: 213, 214

---

### 3.20 Deep Research

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/research` | authed | Initiate deep research task (starts Temporal workflow) | 77 |
| GET | `/api/v1/research/:id` | authed | Get research report | 79 |
| PATCH | `/api/v1/research/:id` | authed | Update research config (re-run with different params) | 82 |
| POST | `/api/v1/research/:id/rerun` | authed | Re-run research with new parameters | 82 |
| GET | `/api/v1/research/:id/export` | authed | Export report as PDF or DOCX (`?format=pdf|docx`) | 80 |

**Request (POST):** `ResearchCreateSchema`
```
{ conversation_id: uuid, query: string, config?: { max_sources?: number, max_iterations?: number } }
```

SSE stream for live progress: see Section 5.3.

---

### 3.21 Models & Providers

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/models` | authed | List available models (respects group-level access restrictions) | 86, 90 |
| GET | `/api/v1/models/:id` | authed | Get model detail (capabilities, cost) | 90 |
| GET | `/api/v1/model-providers` | org-admin | List configured providers | 84 |
| POST | `/api/v1/model-providers` | org-admin | Add provider | 84 |
| PATCH | `/api/v1/model-providers/:id` | org-admin | Update provider (API key, models) | 84 |
| DELETE | `/api/v1/model-providers/:id` | org-admin | Remove provider | 84 |
| GET | `/api/v1/model-providers/:id/models` | org-admin | List models from provider | 84 |
| POST | `/api/v1/model-providers/:id/models` | org-admin | Add model to provider | 84 |
| PATCH | `/api/v1/models/:id` | org-admin | Update model config (default, fallback, costs, enabled) | 85, 88 |
| DELETE | `/api/v1/models/:id` | org-admin | Remove model | 84 |
| POST | `/api/v1/models/compare` | authed | Compare two models side-by-side with a prompt | 87 |
| GET | `/api/v1/litellm/config` | org-admin | Get current LiteLLM proxy config | 83 |
| PATCH | `/api/v1/litellm/config` | org-admin | Update LiteLLM proxy config | 83 |

**Request (compare):** `{ prompt: string, model_ids: [uuid, uuid], params?: object }`

---

### 3.22 Content Filters & DLP Rules

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/content-filters` | org-admin | List content filter rules | 169 |
| POST | `/api/v1/content-filters` | org-admin | Create content filter | 169 |
| PATCH | `/api/v1/content-filters/:id` | org-admin | Update content filter | 169 |
| DELETE | `/api/v1/content-filters/:id` | org-admin | Delete content filter | 169 |
| GET | `/api/v1/dlp-rules` | org-admin | List DLP rules | 170 |
| POST | `/api/v1/dlp-rules` | org-admin | Create DLP rule | 170 |
| PATCH | `/api/v1/dlp-rules/:id` | org-admin | Update DLP rule | 170 |
| DELETE | `/api/v1/dlp-rules/:id` | org-admin | Delete DLP rule | 170 |
| POST | `/api/v1/dlp-rules/:id/test` | org-admin | Test DLP rule against sample text | 170 |

**Request (POST content filter):** `ContentFilterCreateSchema`
```
{ name, type: "input" | "output" | "both", pattern?, action: "block" | "warn" | "redact" | "log", severity?, is_enabled? }
```
**Request (POST DLP rule):** `DlpRuleCreateSchema`
```
{ name, description?, detector_type, pattern?, keywords?, action, applies_to?, is_enabled? }
```

---

### 3.23 Integrations

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/integrations` | org-admin | List configured integrations | 215, 216 |
| POST | `/api/v1/integrations` | org-admin | Create integration (Slack, Teams, etc.) | 215, 216 |
| GET | `/api/v1/integrations/:id` | org-admin | Get integration detail | 215, 216 |
| PATCH | `/api/v1/integrations/:id` | org-admin | Update integration config | 215, 216 |
| DELETE | `/api/v1/integrations/:id` | org-admin | Remove integration | 215, 216 |
| POST | `/api/v1/integrations/:id/test` | org-admin | Test integration connectivity | 215, 216 |
| POST | `/api/v1/integrations/:id/sync` | org-admin | Trigger sync (for cloud storage integrations) | 218 |

**Request (POST):** `IntegrationCreateSchema`
```
{ type: "slack" | "teams" | "email" | "google_drive" | "onedrive", name, config: object }
```

---

### 3.24 Data Jobs (Import/Export & GDPR)

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/data-jobs` | authed | List user's data jobs | 191 |
| POST | `/api/v1/data-jobs/import/chatgpt` | authed | Import conversations from ChatGPT JSON | 191 |
| POST | `/api/v1/data-jobs/import/claude` | authed | Import conversations from Claude.ai | 192 |
| POST | `/api/v1/data-jobs/export` | authed | Export all user data as archive | 193 |
| GET | `/api/v1/data-jobs/:id` | authed | Get job status and progress | 191 |
| GET | `/api/v1/data-jobs/:id/download` | authed | Download completed export file | 193 |
| POST | `/api/v1/data-jobs/admin/gdpr-export/:userId` | org-admin | Generate GDPR data export for user | 195 |
| POST | `/api/v1/data-jobs/admin/gdpr-delete/:userId` | org-admin | Process GDPR deletion request | 194 |
| GET | `/api/v1/data-jobs/admin` | org-admin | List all data jobs in org | 194 |

**Request (import):** `multipart/form-data` with JSON export file
**Note:** All import/export jobs are processed as Temporal workflows. Progress is tracked via the `data_jobs` table.

---

### 3.25 API Keys

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/api-keys` | authed | List user's API keys (prefix only, not full key) | 108, 172 |
| POST | `/api/v1/api-keys` | power | Create API key (full key returned once) | 108 |
| GET | `/api/v1/api-keys/:id` | authed | Get API key metadata | 108 |
| PATCH | `/api/v1/api-keys/:id` | authed | Update API key (name, scopes, expiry) | 172 |
| DELETE | `/api/v1/api-keys/:id` | authed | Revoke API key | 172 |
| POST | `/api/v1/api-keys/:id/rotate` | authed | Rotate API key (old key invalidated, new key returned) | 172 |

**Request (POST):** `ApiKeyCreateSchema`
```
{ name, scopes?: string[], expires_at?: string }
```
**Response (POST):** `{ id, name, key_prefix, key: "nova_...", scopes, expires_at, created_at }` -- `key` field only returned on create and rotate.

---

### 3.26 URL References & Web Scraping

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/urls/preview` | authed | Fetch URL preview (OG metadata, title, description) | 74 |
| POST | `/api/v1/urls/scrape` | authed | Scrape URL content for conversation context | 71, 73 |
| POST | `/api/v1/urls/summarize` | authed | Summarize URL content (article or YouTube) | 72, 73 |
| GET | `/api/v1/urls/domain-rules` | org-admin | Get domain whitelist/blacklist | 75 |
| PUT | `/api/v1/urls/domain-rules` | org-admin | Update domain whitelist/blacklist | 75 |

**Request (preview/scrape):** `{ url: string }`
**Security:** SSRF protection enforced (blocks private IP ranges, DNS rebinding). Stories: 76, 173.

---

### 3.27 Rate Limit Rules

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/rate-limit-rules` | org-admin | List rate limit rules | 178 |
| POST | `/api/v1/rate-limit-rules` | org-admin | Create rate limit rule | 178 |
| PATCH | `/api/v1/rate-limit-rules/:id` | org-admin | Update rate limit rule | 178 |
| DELETE | `/api/v1/rate-limit-rules/:id` | org-admin | Delete rate limit rule | 178 |

**Request (POST):** `RateLimitRuleCreateSchema`
```
{ scope: "user" | "group" | "ip" | "api_key", target_id?: uuid, window_seconds, max_requests, max_tokens?, is_enabled? }
```

---

### 3.28 Workflows

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| GET | `/api/v1/workflows` | authed | List user's workflows (filter: `?type=`, `?status=`) | 53 |
| GET | `/api/v1/workflows/:id` | authed | Get workflow status and progress | 53 |
| POST | `/api/v1/workflows/:id/cancel` | authed | Cancel a running workflow | 52 |
| POST | `/api/v1/workflows/:id/signal` | authed | Send signal to workflow (e.g., user input for human-in-the-loop) | 53 |

---

### 3.29 Batch Operations

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/batch/completions` | power | Submit batch of prompts (async, via API key) | 233 |
| GET | `/api/v1/batch/:id` | power | Get batch job status | 233 |
| GET | `/api/v1/batch/:id/results` | power | Get batch job results | 233 |

**Request (POST):** `BatchCompletionsSchema`
```
{ agent_id?: uuid, model_id?: uuid, prompts: [{ id: string, content: string, params?: object }], callback_url?: string }
```
**Response:** `{ batch_id: uuid, workflow_id: uuid, status: "queued" }` -- results delivered via callback or polling.

---

## 4. WebSocket Protocol

### 4.1 Connection

```
wss://host/api/v1/ws?token=<session_token>
```

- Authentication: Session token passed as query parameter (validated on upgrade)
- Reconnection: Client should reconnect with exponential backoff
- Heartbeat: Server sends `ping` frames every 30 seconds; client must respond with `pong`
- Max connections per user: 5 (story 178)

### 4.2 Message Format

All WebSocket messages use this envelope:

```json
{
  "type": "event_name",
  "payload": { ... },
  "timestamp": "2026-03-06T14:30:00.000Z",
  "requestId": "optional-client-correlation-id"
}
```

### 4.3 Client -> Server Events

| Event Type | Payload | Description | Stories |
|---|---|---|---|
| `subscribe` | `{ channels: string[] }` | Subscribe to channels (e.g., `conversation:<id>`, `workspace:<id>`, `user:<id>`) | -- |
| `unsubscribe` | `{ channels: string[] }` | Unsubscribe from channels | -- |
| `typing.start` | `{ conversation_id: uuid }` | User started typing | 47 |
| `typing.stop` | `{ conversation_id: uuid }` | User stopped typing | 47 |
| `presence.update` | `{ status: "online" \| "away" \| "offline" }` | Update user presence | 47 |

### 4.4 Server -> Client Events

| Event Type | Payload | Channel | Description | Stories |
|---|---|---|---|---|
| `message.created` | `{ message: Message }` | `conversation:<id>` | New message in conversation | 29, 31 |
| `message.updated` | `{ message: Message }` | `conversation:<id>` | Message edited or status changed | 42 |
| `message.deleted` | `{ message_id: uuid }` | `conversation:<id>` | Message deleted | 33 |
| `typing.indicator` | `{ user_id: uuid, user_name: string, is_typing: boolean }` | `conversation:<id>` | Typing indicator from another user | 47 |
| `presence.changed` | `{ user_id: uuid, status: string }` | `workspace:<id>` | User presence changed | 47 |
| `participant.added` | `{ conversation_id: uuid, user: User }` | `conversation:<id>` | New participant joined | 31 |
| `participant.removed` | `{ conversation_id: uuid, user_id: uuid }` | `conversation:<id>` | Participant left/removed | 31 |
| `tool_call.pending` | `{ tool_call: ToolCall }` | `conversation:<id>` | Tool call awaiting approval | 54 |
| `tool_call.progress` | `{ tool_call_id: uuid, status: string, output?: object }` | `conversation:<id>` | Tool call status update | 55, 58 |
| `agent.status` | `{ agent_id: uuid, status: string, step?: number, max_steps?: number }` | `conversation:<id>` | Agent run status (running, waiting, completed) | 52, 55, 59 |
| `workflow.progress` | `{ workflow_id: uuid, status: string, progress: object }` | `user:<id>` | Workflow progress update | 53 |
| `notification.new` | `{ notification: Notification }` | `user:<id>` | New notification | 161-164 |
| `conversation.updated` | `{ conversation: Conversation }` | `workspace:<id>` | Conversation metadata changed | 36, 40 |
| `connection.status` | `{ status: "connected" \| "reconnecting" }` | -- | Connection state info | 201 |
| `error` | `{ code: string, message: string }` | -- | Server-side error | 196 |

### 4.5 Channel Naming Convention

| Pattern | Scope | Example |
|---|---|---|
| `conversation:<uuid>` | Single conversation | `conversation:01912345-abcd-7000-8000-000000000000` |
| `workspace:<uuid>` | Workspace-wide events | `workspace:01912345-abcd-7000-8000-000000000001` |
| `user:<uuid>` | User-specific events (notifications, DMs) | `user:01912345-abcd-7000-8000-000000000002` |
| `org:<uuid>` | Org-wide broadcasts (system status) | `org:01912345-abcd-7000-8000-000000000003` |

**Implementation:** Redis pub/sub for cross-pod fan-out (see TECHNOLOGY_RESEARCH.md, Section 1).

---

## 5. SSE Streams

### 5.1 LLM Token Streaming

```
GET /api/v1/conversations/:id/stream?message_id=<uuid>
```

**Auth:** `authed` (session cookie or Bearer token)

**Headers:**
```
Accept: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Types:**

| Event | Data | Description | Stories |
|---|---|---|---|
| `token` | `{ content: string, index: number }` | Incremental token from LLM | 29, 51 |
| `tool_call` | `{ id: uuid, name: string, input: object, status: "pending" \| "running" }` | Agent initiated a tool call | 54, 55, 144 |
| `tool_result` | `{ id: uuid, name: string, output: object, duration_ms: number }` | Tool call completed | 55, 58 |
| `artifact` | `{ id: uuid, type: string, title?: string, content?: string }` | Agent produced an artifact | 97, 130-143 |
| `metadata` | `{ model_id: uuid, token_count_prompt: number, token_count_completion: number, cost_cents: number }` | Final message metadata | 50 |
| `error` | `{ code: string, message: string, retryable: boolean }` | Error during generation | 196, 200 |
| `done` | `{ message_id: uuid }` | Stream completed | 29 |

**Example stream:**
```
: heartbeat

event: token
data: {"content": "Hello", "index": 0}

event: token
data: {"content": " world", "index": 1}

event: tool_call
data: {"id": "...", "name": "web_search", "input": {"query": "..."}, "status": "pending"}

event: tool_result
data: {"id": "...", "name": "web_search", "output": {"results": [...]}, "duration_ms": 1200}

event: token
data: {"content": "Based on", "index": 2}

event: metadata
data: {"model_id": "...", "token_count_prompt": 150, "token_count_completion": 89, "cost_cents": 2}

event: done
data: {"message_id": "01912345-abcd-7000-8000-000000000000"}
```

**Heartbeat:** `: heartbeat\n\n` every 15 seconds (prevents idle timeout, story R3 in REFINED_SYSTEM_PLAN.md)

**Client behavior:**
- Pause/resume: Client can close and re-open the SSE connection. Server buffers tokens for 30 seconds (story 51).
- Stop: POST to `/api/v1/conversations/:convId/messages/:msgId/stop` to cancel generation (story 52).
- Reconnect: `Last-Event-ID` header supported for resuming after disconnect (story 201, 202).

---

### 5.2 Workflow Progress

```
GET /api/v1/workflows/:id/stream
```

**Auth:** `authed`

**Event Types:**

| Event | Data | Description | Stories |
|---|---|---|---|
| `step` | `{ step_number: number, total_steps: number, description: string }` | Workflow step started | 53, 55 |
| `progress` | `{ percent: number, message: string }` | Progress update | 78 |
| `waiting` | `{ prompt: string, options?: string[] }` | Waiting for user input (human-in-the-loop) | 53, 54 |
| `error` | `{ code: string, message: string, step: number, retryable: boolean }` | Step error | 56, 196 |
| `done` | `{ workflow_id: uuid, output: object }` | Workflow completed | 53 |

Heartbeat: `: heartbeat\n\n` every 15 seconds.

---

### 5.3 Deep Research Progress

```
GET /api/v1/research/:id/stream
```

**Auth:** `authed`

**Event Types:**

| Event | Data | Description | Stories |
|---|---|---|---|
| `search` | `{ query: string, iteration: number }` | Search query dispatched | 78 |
| `source` | `{ url: string, title: string, status: "fetching" \| "analyzing" \| "done" }` | Source being processed | 78 |
| `synthesis` | `{ section: string, content: string }` | Report section being written | 79 |
| `progress` | `{ sources_visited: number, sources_total: number, iteration: number, max_iterations: number }` | Overall progress | 78 |
| `citation` | `{ index: number, url: string, title: string, snippet: string }` | Citation added | 79 |
| `error` | `{ code: string, message: string }` | Research error | 196 |
| `done` | `{ report_id: uuid, sources_count: number }` | Research completed | 79 |

Heartbeat: `: heartbeat\n\n` every 15 seconds.

Stories: 77-82, 81

---

## 6. OpenAI-Compatible Endpoint

```
POST /api/v1/chat/completions
```

**Auth:** API key via `Authorization: Bearer nova_...` or `X-API-Key: nova_...`

This endpoint provides OpenAI API compatibility so external tools (Cursor, Continue, etc.) can use NOVA agents and models.

**Request (follows OpenAI spec):**
```json
{
  "model": "nova-agent-<agent_id>" | "<model_external_id>",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 4096,
  "tools": [],
  "tool_choice": "auto"
}
```

**Response (non-streaming):**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1709740200,
  "model": "nova-agent-...",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "..." },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 89,
    "total_tokens": 239
  }
}
```

**Response (streaming):** Standard OpenAI SSE format with `data: [DONE]` terminator.

**Behavior:**
- API key scoping determines which org, models, and agents the caller can access
- `model` field maps to NOVA agents (prefixed with `nova-agent-`) or LiteLLM model identifiers
- Request is logged in audit trail with `api_key` actor type
- Rate limits applied per API key

Stories: 108, 219

---

## 7. Webhook Endpoints

### 7.1 Agent Trigger Webhook

```
POST /api/v1/webhooks/agent/:agentId/trigger
```

**Auth:** Webhook secret via `X-Webhook-Secret` header (configured per agent)

**Request:**
```json
{
  "message": "Process this data",
  "context": { ... },
  "callback_url": "https://your-service.com/callback"
}
```

**Response:** `202 Accepted`
```json
{
  "workflow_id": "uuid",
  "conversation_id": "uuid",
  "status": "queued"
}
```

**Behavior:**
- Starts a Temporal workflow for the agent
- Results delivered to `callback_url` when complete (if provided)
- SSRF protection on `callback_url` (blocks private IP ranges)

Stories: 106

---

### 7.2 GitHub Secret Scanning

```
POST /api/v1/webhooks/github/secret-scanning
```

**Auth:** GitHub signature verification via `x-hub-signature-256` header

**Purpose:** GitHub alerts NOVA when an API key (`nova_...`) is found in a public repository. NOVA auto-revokes the key and notifies the owner.

**Request:** GitHub Secret Scanning Alert payload
**Response:** `200 OK` with label match results per GitHub spec

Stories: 172

---

### 7.3 Integration Webhooks

```
POST /api/v1/webhooks/slack/events
POST /api/v1/webhooks/teams/events
```

**Auth:** Platform-specific verification (Slack signing secret, Teams HMAC)

**Purpose:** Receive events from Slack/Teams for bot interactions.

Stories: 215, 216

---

## 8. Model Playground

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/playground/completions` | power | Test prompt against a model with custom params | 230 |
| POST | `/api/v1/playground/completions/stream` | power | Same as above, with SSE streaming | 230 |

**Request:** `PlaygroundCompletionSchema`
```
{
  model_id: uuid,
  messages: [{ role: "system" | "user" | "assistant", content: string }],
  params: { temperature?, top_p?, max_tokens?, frequency_penalty?, presence_penalty? },
  show_raw_response?: boolean
}
```

**Response (non-streaming):**
```json
{
  "response": { "role": "assistant", "content": "..." },
  "raw_response": { ... },
  "usage": { "prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150 },
  "latency_ms": 1200,
  "cost_cents": 1
}
```

---

## 9. Sandbox Code Execution

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/sandbox/execute` | authed | Execute code in sandboxed environment | 136 |
| GET | `/api/v1/sandbox/executions/:id` | authed | Get execution result | 136 |

**Request:** `SandboxExecuteSchema`
```
{
  language: "python" | "javascript" | "bash",
  code: string,
  timeout_ms?: number,
  memory_mb?: number
}
```

**Response:**
```json
{
  "id": "uuid",
  "stdout": "...",
  "stderr": "...",
  "exit_code": 0,
  "artifacts": [{ "type": "image", "file_id": "uuid" }],
  "execution_ms": 1500,
  "peak_memory_mb": 45
}
```

**Note:** Typically invoked by agents via tool calls, not directly by users. Resource limits enforced per org settings (story 175).

---

## 10. User Onboarding & Keyboard Shortcuts

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/users/me/onboarding/complete` | authed | Mark onboarding as completed | 220 |
| GET | `/api/v1/users/me/onboarding/status` | authed | Check onboarding status | 220, 221, 222 |
| GET | `/api/v1/keyboard-shortcuts` | authed | Get user's keyboard shortcuts (defaults + overrides) | 187, 188, 189 |
| PUT | `/api/v1/keyboard-shortcuts` | authed | Update keyboard shortcut overrides | 189 |
| DELETE | `/api/v1/keyboard-shortcuts` | authed | Reset to defaults | 189 |
| GET | `/api/v1/sample-conversations` | authed | List sample conversations for onboarding | 221 |

---

## 11. Voice & Multimodal

| Method | Path | Auth | Description | Stories |
|---|---|---|---|---|
| POST | `/api/v1/voice/transcribe` | authed | Transcribe audio file (STT) | 227, 229 |
| POST | `/api/v1/voice/synthesize` | authed | Convert text to speech (TTS) | 228 |
| GET | `/api/v1/voice/synthesize/stream` | authed | Stream TTS audio (SSE with audio chunks) | 228 |

**Request (transcribe):** `multipart/form-data` with audio file
**Response (transcribe):** `{ text: string, language: string, duration_ms: number }`
**Request (synthesize):** `{ text: string, voice?: string, speed?: number }`
**Response (synthesize):** Audio file (binary) or stream

---

## Appendix A: Zod Schema Naming Convention

All request/response schemas are generated from Drizzle table definitions via `drizzle-zod` and extended as needed:

| Pattern | Example | Usage |
|---|---|---|
| `<Entity>CreateSchema` | `ConversationCreateSchema` | POST request body |
| `<Entity>UpdateSchema` | `ConversationUpdateSchema` | PATCH request body |
| `<Entity>Schema` | `ConversationSchema` | Response body (single) |
| `<Entity>ListSchema` | `ConversationListSchema` | Response body (paginated list) |
| `<Entity>FilterSchema` | `ConversationFilterSchema` | Query parameter validation |

---

## Appendix B: HTTP Status Codes

| Status | Usage |
|---|---|
| `200 OK` | Successful GET, PATCH, POST (when returning data) |
| `201 Created` | Successful POST that creates a resource |
| `202 Accepted` | Async operation accepted (webhooks, batch jobs) |
| `204 No Content` | Successful DELETE |
| `400 Bad Request` | Malformed request |
| `401 Unauthorized` | Missing or invalid authentication |
| `403 Forbidden` | Authenticated but insufficient permissions |
| `404 Not Found` | Resource not found (or not accessible in current org) |
| `409 Conflict` | Duplicate resource (e.g., unique constraint violation) |
| `413 Payload Too Large` | File upload exceeds limit |
| `422 Unprocessable Entity` | Request body fails Zod validation |
| `429 Too Many Requests` | Rate limited |
| `500 Internal Server Error` | Unexpected server error |
| `503 Service Unavailable` | Service degraded (health check fail) |

---

## Appendix C: User Story Coverage

Every one of the 234 user stories is covered by at least one endpoint. Stories primarily addressed through frontend-only features (no API required) are noted below:

| Stories | Coverage Notes |
|---|---|
| 14 | Org scoping enforced at service layer on all endpoints |
| 64-67 | File upload/preview endpoints + frontend drag-and-drop/paste |
| 130-135, 138, 140-143 | Artifact rendering is frontend-only; data served via message/artifact endpoints |
| 165-166 | i18n and accessibility are frontend concerns; locale stored via user profile endpoint |
| 174 | Prompt injection mitigations applied at service layer |
| 176-177 | Encryption at rest/in transit is infrastructure-level |
| 187-190 | Keyboard shortcuts stored via API; binding logic is frontend |
| 196-202 | Error UX is frontend; error data comes from API error responses and WebSocket events |
| 222-223 | Contextual tooltips and help center are frontend features |
| 160 | LangFuse/Helicone integration is backend configuration, not an API endpoint |

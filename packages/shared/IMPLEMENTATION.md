# packages/shared -- Implementation Guide

> Runtime: **Both Bun and Node.js**
> Purpose: Pure TypeScript shared code (schemas, types, constants, utilities)
> No runtime-specific dependencies allowed

---

## Constraint

This package MUST work in both Bun (`packages/api`) and Node.js (`packages/worker`). This means:

- No `Bun.*` APIs
- No `node:*` imports that are Bun-incompatible
- No native modules (N-API, WASM with platform-specific binaries)
- No filesystem or network I/O (pure logic only)
- All dependencies must be isomorphic (pure JS/TS)

---

## Directory Structure

```
packages/shared/
├── src/
│   ├── index.ts                    # Re-exports everything
│   ├── schemas/
│   │   ├── index.ts                # Re-exports all schemas
│   │   ├── organisations.ts        # organisations, org_settings table schemas + Zod
│   │   ├── users.ts                # users, user_profiles, sessions, mfa_credentials
│   │   ├── groups.ts               # groups, group_members
│   │   ├── conversations.ts        # conversations, conversation_participants
│   │   ├── messages.ts             # messages, message_edits, message_ratings
│   │   ├── agents.ts               # agents, agent_versions, agent_tools
│   │   ├── tools.ts                # tools, tool_definitions
│   │   ├── mcp.ts                  # mcp_servers, mcp_connections
│   │   ├── knowledge.ts            # knowledge_collections, knowledge_documents, knowledge_chunks
│   │   ├── memory.ts               # agent_memories
│   │   ├── workspaces.ts           # workspaces, workspace_members
│   │   ├── files.ts                # files, file_attachments
│   │   ├── prompts.ts              # prompt_templates, prompt_versions
│   │   ├── notifications.ts        # notifications, notification_preferences
│   │   ├── analytics.ts            # usage_records, budget_alerts
│   │   ├── audit.ts                # audit_logs
│   │   ├── api-keys.ts             # api_keys
│   │   └── sandbox.ts              # sandbox_executions
│   ├── types/
│   │   ├── index.ts                # Re-exports all types
│   │   ├── api.ts                  # API request/response types
│   │   ├── ws-events.ts            # WebSocket event types
│   │   ├── sse-events.ts           # SSE event types
│   │   ├── agent.ts                # Agent-related types (tool calls, memory, etc.)
│   │   └── auth.ts                 # Session, user, role types
│   ├── constants/
│   │   ├── index.ts                # Re-exports all constants
│   │   ├── roles.ts                # User role enum and hierarchy
│   │   ├── permissions.ts          # Permission matrix per role
│   │   ├── status.ts               # Status enums (conversation, message, agent, workflow)
│   │   ├── rate-limits.ts          # Default rate limit values
│   │   ├── file-types.ts           # Allowed MIME types, max sizes
│   │   └── defaults.ts             # System-wide defaults (pagination, timeouts, etc.)
│   └── utils/
│       ├── index.ts                # Re-exports all utils
│       ├── url-validation.ts       # SSRF-safe URL validation
│       ├── slug.ts                 # URL-safe slug generation
│       ├── pagination.ts           # Pagination helpers (offset/limit, cursor)
│       ├── uuid.ts                 # UUIDv7 generation (using standard uuid package)
│       └── errors.ts               # AppError class, error type constants
├── package.json
└── tsconfig.json
```

---

## Drizzle Schema Definitions

All 59 tables defined in `docs/DOMAIN_MODEL.md` are implemented as Drizzle schemas. Both `packages/api` and `packages/worker` import these schemas.

### Pattern: Table Definition + Zod Schemas

```typescript
// src/schemas/conversations.ts
import { pgTable, text, uuid, timestamptz, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organisations } from "./organisations";
import { users } from "./users";
import { workspaces } from "./workspaces";

// ── Table Definition ──────────────────────────────

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  creatorId: uuid("creator_id").notNull().references(() => users.id),
  title: text("title"),
  systemPrompt: text("system_prompt"),
  model: text("model"),
  temperature: integer("temperature"),       // stored as int (e.g. 70 = 0.7)
  topP: integer("top_p"),
  visibility: text("visibility").notNull().default("private"),  // private, team, public
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  forkSourceId: uuid("fork_source_id"),      // self-reference for forked conversations
  forkMessageId: uuid("fork_message_id"),    // message where fork started
  shareToken: text("share_token"),           // for public read-only links
  tokenCount: integer("token_count").notNull().default(0),
  estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  deletedAt: timestamptz("deleted_at"),
});

// ── Zod Schemas (generated from Drizzle) ──────────

export const selectConversationSchema = createSelectSchema(conversations);
export const insertConversationSchema = createInsertSchema(conversations, {
  // Override/extend auto-generated validators
  title: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  visibility: z.enum(["private", "team", "public"]).default("private"),
  temperature: z.number().int().min(0).max(200).optional(),
  topP: z.number().int().min(0).max(100).optional(),
}).omit({
  id: true,
  orgId: true,         // injected by org-scope middleware
  creatorId: true,     // injected by auth middleware
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  tokenCount: true,
  estimatedCostCents: true,
});

export const updateConversationSchema = insertConversationSchema.partial();

// ── Inferred Types ────────────────────────────────

export type Conversation = z.infer<typeof selectConversationSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
```

### Pattern: Vector Column (Knowledge Chunks)

```typescript
// src/schemas/knowledge.ts
import { pgTable, text, uuid, timestamptz, integer, jsonb, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core"; // Drizzle native pgvector support

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  collectionId: uuid("collection_id").notNull(),
  documentId: uuid("document_id").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),   // pgvector column
  chunkIndex: integer("chunk_index").notNull(),
  metadata: jsonb("metadata"),                             // { source, page, etc. }
  tokenCount: integer("token_count"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  deletedAt: timestamptz("deleted_at"),
}, (table) => [
  // HNSW index for cosine similarity search
  index("knowledge_chunks_embedding_idx")
    .using("hnsw", table.embedding.op("vector_cosine_ops")),
  index("knowledge_chunks_collection_idx")
    .on(table.collectionId),
  index("knowledge_chunks_org_idx")
    .on(table.orgId),
]);
```

### Schema Index File

```typescript
// src/schemas/index.ts
export * from "./organisations";
export * from "./users";
export * from "./groups";
export * from "./conversations";
export * from "./messages";
export * from "./agents";
export * from "./tools";
export * from "./mcp";
export * from "./knowledge";
export * from "./memory";
export * from "./workspaces";
export * from "./files";
export * from "./prompts";
export * from "./notifications";
export * from "./analytics";
export * from "./audit";
export * from "./api-keys";
export * from "./sandbox";
```

---

## Shared Types

### API Request/Response Types

```typescript
// src/types/api.ts

// Paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Cursor-based pagination
export interface CursorResponse<T> {
  data: T[];
  nextCursor: string | null;
}

// Standard pagination params
export interface PaginationParams {
  page?: number;
  pageSize?: number;    // default: 20, max: 100
}

// Standard error response (RFC 7807)
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
}
```

### WebSocket Event Types

```typescript
// src/types/ws-events.ts

// Client -> Server
export type ClientWSEvent =
  | { type: "typing.start"; conversationId: string }
  | { type: "typing.stop"; conversationId: string }
  | { type: "presence.ping" };

// Server -> Client
export type ServerWSEvent =
  | { type: "typing.start"; conversationId: string; userId: string }
  | { type: "typing.stop"; conversationId: string; userId: string }
  | { type: "presence.online"; userId: string }
  | { type: "presence.offline"; userId: string }
  | { type: "message.new"; conversationId: string; messageId: string }
  | { type: "conversation.updated"; conversationId: string }
  | { type: "notification.new"; id: string; type: string; title: string; body: string }
  | { type: "workflow.progress"; workflowId: string; progress: unknown };
```

### SSE Event Types

```typescript
// src/types/sse-events.ts

export type SSEEvent =
  | { event: "token"; data: { content: string } }
  | { event: "tool_call"; data: { id: string; name: string; arguments: string } }
  | { event: "tool_result"; data: { id: string; result: unknown } }
  | { event: "approval_required"; data: { toolCallId: string; name: string; args: unknown } }
  | { event: "error"; data: { message: string; code: string } }
  | { event: "done"; data: "" }
  | { event: "heartbeat"; data: "" };
```

---

## Constants

### Roles & Permissions

```typescript
// src/constants/roles.ts
export const ROLES = ["super-admin", "org-admin", "power-user", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

// Role hierarchy: higher index = more permissions
export const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  member: 1,
  "power-user": 2,
  "org-admin": 3,
  "super-admin": 4,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
```

```typescript
// src/constants/permissions.ts
export const PERMISSIONS = {
  // Conversations
  "conversation.create": "member",
  "conversation.read": "viewer",
  "conversation.update": "member",
  "conversation.delete": "member",
  "conversation.share": "member",

  // Agents
  "agent.create": "power-user",
  "agent.read": "member",
  "agent.update": "power-user",
  "agent.delete": "power-user",
  "agent.publish": "power-user",

  // Knowledge Collections
  "knowledge.create": "power-user",
  "knowledge.read": "member",
  "knowledge.update": "power-user",
  "knowledge.delete": "power-user",

  // Admin
  "users.manage": "org-admin",
  "groups.manage": "org-admin",
  "org.settings": "org-admin",
  "audit.read": "org-admin",
  "analytics.read": "org-admin",

  // Super Admin
  "orgs.manage": "super-admin",
  "system.health": "super-admin",
} as const satisfies Record<string, Role>;
```

### Status Enums

```typescript
// src/constants/status.ts
export const CONVERSATION_VISIBILITY = ["private", "team", "public"] as const;
export const MESSAGE_ROLE = ["user", "assistant", "system", "tool"] as const;
export const AGENT_STATUS = ["draft", "published", "archived"] as const;
export const TOOL_APPROVAL_MODE = ["auto", "always-ask", "never"] as const;
export const WORKFLOW_STATUS = ["running", "waiting_approval", "waiting_input", "completed", "stopped", "error"] as const;
export const FILE_STATUS = ["uploading", "processing", "ready", "infected", "error"] as const;
export const COLLECTION_STATUS = ["empty", "indexing", "ready", "error"] as const;
export const NOTIFICATION_TYPE = ["share", "mention", "agent_complete", "export_ready", "system"] as const;
```

### Rate Limits

```typescript
// src/constants/rate-limits.ts
export const RATE_LIMITS = {
  PER_IP: {
    maxRequests: 100,
    windowSeconds: 60,
  },
  PER_USER: {
    maxRequests: 300,
    windowSeconds: 60,
  },
  PER_ORG: {
    maxRequests: 5000,
    windowSeconds: 60,
  },
  LLM_CALLS: {
    maxRequests: 30,
    windowSeconds: 60,
  },
  FILE_UPLOADS: {
    maxRequests: 20,
    windowSeconds: 60,
  },
} as const;
```

### File Types

```typescript
// src/constants/file-types.ts
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // XLSX
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/webm",
] as const;

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILES_PER_MESSAGE = 10;
```

### Defaults

```typescript
// src/constants/defaults.ts
export const DEFAULTS = {
  PAGINATION_PAGE_SIZE: 20,
  PAGINATION_MAX_PAGE_SIZE: 100,
  SESSION_TTL_SECONDS: 86400,         // 24 hours
  SSE_HEARTBEAT_INTERVAL_MS: 15_000,  // 15 seconds
  WS_RECONNECT_INTERVAL_MS: 3000,
  AGENT_MAX_STEPS: 25,
  SANDBOX_TIMEOUT_MS: 30_000,
  SANDBOX_MEMORY_MB: 256,
  EMBEDDING_DIMENSIONS: 1536,
  CHUNK_SIZE: 512,
  CHUNK_OVERLAP: 50,
  AUDIT_LOG_RETENTION_DAYS: 90,
} as const;
```

---

## Utility Functions

### URL Validation (SSRF Protection)

```typescript
// src/utils/url-validation.ts
import { z } from "zod";

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((regex) => regex.test(ip));
}

export const safeUrlSchema = z
  .string()
  .url()
  .refine((url) => {
    const parsed = new URL(url);
    // Block private schemes
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    // Block private hostnames
    if (parsed.hostname === "localhost") return false;
    if (isPrivateIP(parsed.hostname)) return false;
    return true;
  }, "URL points to a private or disallowed address");
```

### Slug Generation

```typescript
// src/utils/slug.ts
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")     // Remove special chars
    .replace(/[\s_]+/g, "-")       // Spaces/underscores to hyphens
    .replace(/-+/g, "-")           // Collapse multiple hyphens
    .replace(/^-|-$/g, "");        // Trim leading/trailing hyphens
}

export function generateUniqueSlug(input: string): string {
  const base = generateSlug(input);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
```

### Pagination Helpers

```typescript
// src/utils/pagination.ts
import { DEFAULTS } from "../constants/defaults";

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginationResult {
  offset: number;
  limit: number;
  page: number;
  pageSize: number;
}

export function parsePagination(input: PaginationInput): PaginationResult {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    DEFAULTS.PAGINATION_MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULTS.PAGINATION_PAGE_SIZE)
  );
  return {
    offset: (page - 1) * pageSize,
    limit: pageSize,
    page,
    pageSize,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationResult
) {
  return {
    data,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasMore: pagination.offset + data.length < total,
  };
}
```

### AppError Class

```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
    public type: string = "https://nova.dev/errors/generic"
  ) {
    super(title);
    this.name = "AppError";
  }

  static notFound(resource: string) {
    return new AppError(404, "Not Found", `${resource} not found`, "https://nova.dev/errors/not-found");
  }

  static forbidden(detail?: string) {
    return new AppError(403, "Forbidden", detail, "https://nova.dev/errors/forbidden");
  }

  static conflict(detail: string) {
    return new AppError(409, "Conflict", detail, "https://nova.dev/errors/conflict");
  }

  static badRequest(detail: string) {
    return new AppError(400, "Bad Request", detail, "https://nova.dev/errors/bad-request");
  }
}
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "drizzle-orm": "1.0.0-beta.x",
    "drizzle-zod": "1.0.0-beta.x",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

Only three runtime dependencies, all pure TypeScript. No platform-specific code.

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Package Exports

```json
{
  "name": "@nova/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schemas/index.ts",
    "./schemas": "./src/schemas/index.ts",
    "./types": "./src/types/index.ts",
    "./constants": "./src/constants/index.ts",
    "./utils": "./src/utils/index.ts"
  }
}
```

Both Bun and Node.js (via TypeScript project references or tsx) resolve these exports at build/dev time. In production, the consuming packages bundle the shared code into their own output.

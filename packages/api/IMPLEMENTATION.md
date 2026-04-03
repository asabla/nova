# packages/api -- Implementation Guide

> Runtime: **Bun**
> Framework: **Hono**
> Port: **3000**

---

## Directory Structure

```
packages/api/
├── src/
│   ├── index.ts                  # Bun.serve() entry point
│   ├── app.ts                    # Hono app factory (middleware chain, route mounting)
│   ├── routes/
│   │   ├── auth.ts               # Better Auth mount (/api/auth/*)
│   │   ├── conversations.ts      # CRUD, fork, share, archive, search
│   │   ├── messages.ts           # Send, edit, rate, notes, stream (SSE)
│   │   ├── agents.ts             # CRUD, version, clone, publish
│   │   ├── tools.ts              # Tool registry, test, enable/disable
│   │   ├── mcp.ts                # MCP server connections, tool discovery
│   │   ├── knowledge.ts          # Collections CRUD, re-index, test query
│   │   ├── files.ts              # Upload (presigned URL), download, delete
│   │   ├── workspaces.ts         # CRUD, members, activity feed
│   │   ├── users.ts              # Profile, sessions, preferences
│   │   ├── groups.ts             # CRUD, membership, quotas
│   │   ├── orgs.ts               # Org settings, branding, health
│   │   ├── admin.ts              # Super-admin: orgs, system health, diagnostics
│   │   ├── prompts.ts            # Prompt library CRUD, share, version
│   │   ├── search.ts             # Cross-entity search, semantic search
│   │   ├── analytics.ts          # Usage stats, cost breakdown, export
│   │   ├── notifications.ts      # In-app notifications, preferences
│   │   └── health.ts             # /health, /ready endpoints
│   ├── middleware/
│   │   ├── auth.ts               # Session validation via Better Auth
│   │   ├── org-scope.ts          # Extract org_id from session, inject into context
│   │   ├── rbac.ts               # Role-based access control (requireRole('org-admin'))
│   │   ├── rate-limit.ts         # Redis token bucket (per-user, per-IP, per-org)
│   │   ├── request-id.ts         # Generate X-Request-Id (UUIDv7), attach to context
│   │   ├── logger.ts             # Structured JSON logging (request/response, timing)
│   │   ├── error-handler.ts      # Catch-all, RFC 7807 Problem Details
│   │   ├── cors.ts               # CORS config (allowed origins from env)
│   │   └── security-headers.ts   # CSP, X-Frame-Options, HSTS, etc.
│   ├── services/
│   │   ├── conversation.service.ts
│   │   ├── message.service.ts
│   │   ├── agent.service.ts
│   │   ├── knowledge.service.ts
│   │   ├── file.service.ts
│   │   ├── workspace.service.ts
│   │   ├── user.service.ts
│   │   ├── group.service.ts
│   │   ├── org.service.ts
│   │   ├── search.service.ts
│   │   ├── analytics.service.ts
│   │   ├── notification.service.ts
│   │   ├── prompt.service.ts
│   │   └── audit.service.ts      # Writes to audit_logs table
│   ├── lib/
│   │   ├── db.ts                 # Drizzle client (postgres-js driver)
│   │   ├── redis.ts              # ioredis client (single instance + pub/sub pair)
│   │   ├── minio.ts              # RustFS client (presigned URLs, bucket ops)
│   │   ├── temporal.ts           # @temporalio/client (Connection, WorkflowClient)
│   │   ├── auth.ts               # Better Auth instance (betterAuth config)
│   │   ├── litellm.ts            # HTTP client wrapper for LiteLLM API
│   │   └── env.ts                # Zod-validated environment variables
│   ├── ws/
│   │   ├── handler.ts            # Hono upgradeWebSocket + connection registry
│   │   ├── redis-pubsub.ts       # Redis subscribe/publish for fan-out
│   │   └── events.ts             # Event type handlers (typing, presence, updates)
│   └── types/
│       └── context.ts            # Hono context variable types (orgId, userId, requestId)
├── Dockerfile                    # Multi-stage: bun install -> bun build -> runtime
├── package.json
└── tsconfig.json
```

---

## Hono App Setup

### Entry Point (`src/index.ts`)

```typescript
import { app } from "./app";

Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3000),
  idleTimeout: 0, // CRITICAL: prevents Bun from killing SSE streams
});

console.log(`API server running on port ${process.env.PORT ?? 3000}`);
```

### Middleware Chain (`src/app.ts`)

Order matters. The chain is applied top-to-bottom for requests, bottom-to-top for responses.

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { requestId } from "./middleware/request-id";
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/error-handler";
import { rateLimiter } from "./middleware/rate-limit";
import { authMiddleware } from "./middleware/auth";
import { orgScope } from "./middleware/org-scope";
import type { AppContext } from "./types/context";

const app = new Hono<AppContext>();

// 1. Error handler (outermost -- catches everything)
app.onError(errorHandler);

// 2. Security headers (CSP, HSTS, X-Frame-Options)
app.use("*", secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "blob:", "data:"],
    connectSrc: ["'self'", "wss://*"],
    frameAncestors: ["'none'"],
  },
}));

// 3. CORS
app.use("*", cors({
  origin: process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:5173"],
  credentials: true,
}));

// 4. Request ID
app.use("*", requestId());

// 5. Logger
app.use("*", logger());

// 6. Rate limiting (Redis token bucket)
app.use("/api/*", rateLimiter());

// 7. Auth routes (unauthenticated -- Better Auth handles its own auth)
app.route("/api/auth", authRoutes);

// 8. Health check (unauthenticated)
app.route("/health", healthRoutes);

// 9. Auth middleware (everything below requires a valid session)
app.use("/api/*", authMiddleware());

// 10. Org scoping (injects orgId into context from session)
app.use("/api/*", orgScope());

// 11. Route groups
app.route("/api/conversations", conversationRoutes);
app.route("/api/messages", messageRoutes);
app.route("/api/agents", agentRoutes);
// ... all other routes

export { app };
```

### Context Type

```typescript
// src/types/context.ts
type AppContext = {
  Variables: {
    requestId: string;
    userId: string;
    orgId: string;
    userRole: "super-admin" | "org-admin" | "power-user" | "member" | "viewer";
  };
};
```

---

## Better Auth Integration

Mount Better Auth at `/api/auth/*`. It handles sign-up, login, sessions, OAuth, MFA, and organizations.

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  session: {
    cookieName: "nova_session",
    maxAge: 60 * 60 * 24, // 24 hours
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    },
  },
  plugins: [
    organization({
      roles: ["org-admin", "power-user", "member", "viewer"],
      defaultRole: "member",
    }),
  ],
  socialProviders: {
    azure: {
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    },
    // google, github configurable per org
  },
});
```

```typescript
// src/routes/auth.ts -- mount to Hono
import { Hono } from "hono";
import { auth } from "../lib/auth";

const authRoutes = new Hono();
authRoutes.all("/*", (c) => auth.handler(c.req.raw));

export { authRoutes };
```

---

## Drizzle ORM + Org-Scoping

### Database Client

```typescript
// src/lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@nova/shared/schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

### Org-Scoping Middleware

Every service method receives `orgId` and includes it in every query. This is the primary IDOR defense.

```typescript
// src/middleware/org-scope.ts
import { createMiddleware } from "hono/factory";

export const orgScope = () =>
  createMiddleware(async (c, next) => {
    const session = c.get("session");
    const orgId = session.activeOrganizationId;
    if (!orgId) {
      return c.json({ type: "about:blank", title: "No active organization", status: 403 }, 403);
    }
    c.set("orgId", orgId);
    await next();
  });
```

### Service Pattern (org-scoped queries)

```typescript
// src/services/conversation.service.ts
import { db } from "../lib/db";
import { conversations } from "@nova/shared/schema";
import { eq, and, isNull } from "drizzle-orm";

export function listConversations(orgId: string, userId: string) {
  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, orgId),        // ALWAYS present
        eq(conversations.creatorId, userId),
        isNull(conversations.deletedAt)        // soft-delete filter
      )
    );
}
```

---

## SSE Streaming (LLM Token Streaming)

Used for streaming LLM responses to the client. The API receives a streaming response from LiteLLM and forwards tokens via SSE.

```typescript
// src/routes/messages.ts (streaming endpoint)
import { streamSSE } from "hono/streaming";

app.post("/api/conversations/:id/messages/stream", async (c) => {
  const orgId = c.get("orgId");
  const conversationId = c.req.param("id");
  const body = await c.req.json();

  return streamSSE(c, async (stream) => {
    // Start heartbeat (prevents Bun idle timeout killing the stream)
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: "heartbeat", data: "" });
    }, 15_000);

    try {
      // Call LiteLLM streaming endpoint
      const response = await fetch(`${process.env.LITELLM_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}`,
        },
        body: JSON.stringify({
          model: body.model,
          messages: body.messages,
          stream: true,
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Parse SSE lines from LiteLLM, forward to client
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            const data = JSON.parse(line.slice(6));
            const token = data.choices?.[0]?.delta?.content;
            if (token) {
              await stream.writeSSE({
                event: "token",
                data: JSON.stringify({ content: token }),
              });
            }
          }
        }
      }

      await stream.writeSSE({ event: "done", data: "" });
    } finally {
      clearInterval(heartbeat);
    }
  });
});
```

### SSE Event Types

| Event | Data | Purpose |
|-------|------|---------|
| `token` | `{ content: string }` | Incremental LLM token |
| `tool_call` | `{ id, name, arguments }` | Agent wants to call a tool |
| `tool_result` | `{ id, result }` | Tool call completed |
| `approval_required` | `{ toolCallId, name, args }` | Human-in-the-loop: approve/reject |
| `error` | `{ message, code }` | Stream error |
| `done` | `""` | Stream complete |
| `heartbeat` | `""` | Keep-alive (every 15s) |

---

## WebSocket Setup

Used for real-time features: typing indicators, presence, conversation updates, notifications.

```typescript
// src/ws/handler.ts
import { upgradeWebSocket } from "hono/bun";
import { redisSubscriber, redisPublisher } from "./redis-pubsub";

// Connection registry (per-process, not shared across pods)
const connections = new Map<string, Set<WebSocket>>();

export const wsRoute = upgradeWebSocket((c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const channel = `org:${orgId}`;

  return {
    onOpen(evt, ws) {
      // Add to local registry
      if (!connections.has(channel)) connections.set(channel, new Set());
      connections.get(channel)!.add(ws.raw as WebSocket);

      // Subscribe to Redis channel (idempotent per channel)
      redisSubscriber.subscribe(channel);
    },

    onMessage(evt, ws) {
      const msg = JSON.parse(evt.data as string);
      // Client sends: typing indicators, presence updates
      // Publish to Redis for fan-out to all pods
      redisPublisher.publish(channel, JSON.stringify({
        type: msg.type,
        userId,
        ...msg.payload,
      }));
    },

    onClose(evt, ws) {
      connections.get(channel)?.delete(ws.raw as WebSocket);
    },
  };
});
```

```typescript
// src/ws/redis-pubsub.ts
import Redis from "ioredis";

export const redisSubscriber = new Redis(process.env.REDIS_URL!);
export const redisPublisher = new Redis(process.env.REDIS_URL!);

// When Redis delivers a message, broadcast to all local WebSocket connections
redisSubscriber.on("message", (channel, message) => {
  const sockets = connections.get(channel);
  if (!sockets) return;
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
});
```

### WebSocket Event Types

| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `typing.start` | Client -> Server | `{ conversationId }` | User started typing |
| `typing.stop` | Client -> Server | `{ conversationId }` | User stopped typing |
| `presence.online` | Server -> Client | `{ userId }` | User came online |
| `presence.offline` | Server -> Client | `{ userId }` | User went offline |
| `conversation.updated` | Server -> Client | `{ conversationId }` | Conversation metadata changed |
| `message.new` | Server -> Client | `{ conversationId, messageId }` | New message (triggers query invalidation) |
| `notification.new` | Server -> Client | `{ id, type, title }` | In-app notification |

---

## Temporal Client Integration

The API server uses `@temporalio/client` to start workflows, send signals, and query state. The actual workflow execution happens in `packages/worker`.

```typescript
// src/lib/temporal.ts
import { Connection, Client } from "@temporalio/client";

let client: Client;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
    });
    client = new Client({ connection });
  }
  return client;
}
```

### Starting Workflows from Routes

```typescript
// src/routes/messages.ts (agent conversation)
import { getTemporalClient } from "../lib/temporal";

app.post("/api/conversations/:id/agent-run", async (c) => {
  const client = await getTemporalClient();
  const workflowId = `agent-${c.req.param("id")}-${Date.now()}`;

  const handle = await client.workflow.start("agentConversationWorkflow", {
    taskQueue: "nova-workers",
    workflowId,
    args: [{
      conversationId: c.req.param("id"),
      orgId: c.get("orgId"),
      userId: c.get("userId"),
      model: body.model,
      messages: body.messages,
    }],
  });

  return c.json({ workflowId: handle.workflowId });
});

// Send signal (human-in-the-loop: approve tool call)
app.post("/api/workflows/:workflowId/approve-tool", async (c) => {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(c.req.param("workflowId"));
  await handle.signal("approveToolCall", { toolCallId: body.toolCallId, approved: true });
  return c.json({ ok: true });
});

// Query workflow progress
app.get("/api/workflows/:workflowId/progress", async (c) => {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(c.req.param("workflowId"));
  const progress = await handle.query("getProgress");
  return c.json(progress);
});
```

---

## RustFS Client

```typescript
// src/lib/minio.ts
import { Client as MinioClient } from "minio";

export const minio = new MinioClient({
  endPoint: new URL(process.env.MINIO_ENDPOINT!).hostname,
  port: Number(new URL(process.env.MINIO_ENDPOINT!).port),
  useSSL: process.env.MINIO_ENDPOINT!.startsWith("https"),
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});

const BUCKET = process.env.MINIO_BUCKET ?? "nova-files";

// Generate presigned upload URL (client uploads directly to RustFS)
export async function getUploadUrl(orgId: string, filename: string): Promise<string> {
  const key = `${orgId}/${crypto.randomUUID()}/${filename}`;
  return minio.presignedPutObject(BUCKET, key, 60 * 15); // 15 min expiry
}

// Generate presigned download URL
export async function getDownloadUrl(key: string): Promise<string> {
  return minio.presignedGetObject(BUCKET, key, 60 * 60); // 1 hour expiry
}
```

---

## Redis Client

```typescript
// src/lib/redis.ts
import Redis from "ioredis";

// General-purpose client (sessions, rate limiting, caching)
export const redis = new Redis(process.env.REDIS_URL!);

// Dedicated pub/sub pair (subscriber cannot be used for commands)
export const redisSub = new Redis(process.env.REDIS_URL!);
export const redisPub = new Redis(process.env.REDIS_URL!);
```

---

## Rate Limiting

Token bucket implemented in Redis. Three tiers: per-IP (anonymous), per-user, per-org.

```typescript
// src/middleware/rate-limit.ts
import { createMiddleware } from "hono/factory";
import { redis } from "../lib/redis";
import { RATE_LIMITS } from "@nova/shared/constants";

export const rateLimiter = () =>
  createMiddleware(async (c, next) => {
    const ip = c.req.header("x-forwarded-for") ?? "unknown";
    const userId = c.get("userId"); // may be undefined for auth routes
    const key = userId ? `rl:user:${userId}` : `rl:ip:${ip}`;
    const limit = userId ? RATE_LIMITS.PER_USER : RATE_LIMITS.PER_IP;

    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, limit.windowSeconds);

    if (current > limit.maxRequests) {
      const ttl = await redis.ttl(key);
      return c.json(
        {
          type: "https://nova.dev/errors/rate-limited",
          title: "Rate limit exceeded",
          status: 429,
          detail: `Try again in ${ttl} seconds`,
          retryAfter: ttl,
        },
        429,
        { "Retry-After": String(ttl) }
      );
    }

    await next();
  });
```

---

## Zod Validation

All route inputs are validated with Zod. Use schemas from `@nova/shared` where possible.

```typescript
// src/routes/conversations.ts
import { zValidator } from "@hono/zod-validator";
import { insertConversationSchema } from "@nova/shared/schemas";

app.post(
  "/api/conversations",
  zValidator("json", insertConversationSchema),
  async (c) => {
    const data = c.req.valid("json");
    // data is fully typed and validated
    const result = await conversationService.create(c.get("orgId"), c.get("userId"), data);
    return c.json(result, 201);
  }
);
```

---

## Error Handling (RFC 7807 Problem Details)

```typescript
// src/middleware/error-handler.ts
import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[${c.get("requestId")}] ${err.message}`, err.stack);

  // Known application errors
  if (err instanceof AppError) {
    return c.json(
      {
        type: err.type,
        title: err.title,
        status: err.status,
        detail: err.detail,
        instance: c.req.url,
      },
      err.status
    );
  }

  // Zod validation errors
  if (err.name === "ZodError") {
    return c.json(
      {
        type: "https://nova.dev/errors/validation",
        title: "Validation Error",
        status: 400,
        errors: err.issues,
      },
      400
    );
  }

  // Fallback
  return c.json(
    {
      type: "https://nova.dev/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: process.env.NODE_ENV === "development" ? err.message : "An unexpected error occurred",
    },
    500
  );
};
```

---

## Dockerfile

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY packages/api packages/api
RUN bun build packages/api/src/index.ts --target=bun --outdir=dist

FROM base AS runtime
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "hono": "^4.12.0",
    "@hono/zod-validator": "^0.4.0",
    "drizzle-orm": "1.0.0-beta.x",
    "postgres": "^3.4.0",
    "better-auth": "^1.4.0",
    "ioredis": "^5.4.0",
    "minio": "^8.0.0",
    "@temporalio/client": "^1.11.0",
    "zod": "^3.23.0",
    "@nova/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "1.0.0-beta.x"
  }
}
```

---

## Environment Variables

Validated at startup via Zod (see `src/lib/env.ts`). The full set is documented in `infra/INFRASTRUCTURE.md`.

Required:
- `DATABASE_URL` -- PostgreSQL connection string
- `REDIS_URL` -- Redis connection string
- `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`
- `LITELLM_API_URL`, `LITELLM_MASTER_KEY`
- `TEMPORAL_ADDRESS`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `CORS_ORIGINS` -- comma-separated allowed origins

Optional:
- `PORT` (default: 3000)
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`

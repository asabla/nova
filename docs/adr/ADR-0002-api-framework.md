# ADR-0002: API Framework Selection

- **Status:** Accepted
- **Date:** 2026-03-06
- **Deciders:** NOVA Core Team

## Context

NOVA needs an HTTP framework running on Bun that supports:
- SSE streaming for LLM token delivery
- WebSocket for multi-user real-time features (typing indicators, live messages)
- Strong middleware for auth, rate limiting, validation, CORS
- Production stability suitable for enterprise deployment
- Good TypeScript developer experience

Three candidates were evaluated: **Elysia** (Bun-native), **Hono** (multi-runtime), and **Fastify** (Node.js with Bun compat).

## Evaluation

### Summary Table

| Criteria | Elysia | Hono | Fastify |
|---|---|---|---|
| GitHub Stars | ~17,500 | ~29,200 | ~35,800 |
| Contributors | ~118 | ~304 | ~866 |
| Bun Native | Yes (built for Bun) | Yes (multi-runtime) | No (compat layer) |
| WebSocket | Bun-native pub/sub | Basic (no pub/sub on Bun) | Via ws library |
| SSE | Built-in (has bugs) | streamSSE() helper (stable) | Via plugin |
| TypeScript DX | Best (end-to-end inference) | Very good (hono/client) | Good (type providers) |
| Middleware | Smaller ecosystem (~118 contrib) | Good & growing (~304 contrib) | Best (200+ official plugins) |
| Stability | Least stable (critical open bugs) | Stable (v4) | Most stable (v5, 7+ years) |
| Runtime lock-in | Bun only | None (Bun/Node/Deno/CF Workers) | Node.js primarily |

### Bun Native Compatibility

**Elysia** — Best raw performance. Uses `Bun.serve()` directly. No abstraction overhead.

**Hono** — Runs natively on Bun via built-in adapter. Does not exploit Bun-specific APIs as deeply but has no compatibility issues.

**Fastify** — Runs through Bun's Node.js compatibility layer. Known issues: `Server.setTimeout` not implemented (issue #5326), unpredictable plugin behavior (issue #4991). Not recommended for Bun-first.

### WebSocket Support

**Elysia** — First-class, built on Bun's native `ServerWebSocket` with topic-based pub/sub. However, critical bug: WebSocket object identity is NOT stable across lifecycle hooks (issue #1737, Feb 2026). Storing sockets in a Map/Set breaks. Fix PR open but not merged.

**Hono** — Thin `hono/ws` abstraction. Does NOT expose Bun's native pub/sub (issue #3230, open since Aug 2024). Broadcasting requires manual loops or Redis pub/sub.

**Fastify** — Mature via `@fastify/websocket` (based on `ws` library). Works through Node.js compat layer on Bun.

### SSE Streaming

**Critical Bun issue affecting ALL frameworks:** Bun's default `idleTimeout` silently kills quiet SSE streams after ~10 seconds (issues #13811, #27479). MUST set `idleTimeout: 0` and implement heartbeats.

**Elysia** — Built-in but has a severe bug: `ReadableStream` responses get `JSON.stringify`'d instead of streamed as bytes (issue #1772, Mar 2026). Unacceptable for LLM token delivery until fixed.

**Hono** — `streamSSE()` helper is clean and stable. No serialization bugs. Works across all runtimes.

**Fastify** — Via `@fastify/sse` or manual `reply.raw` streaming. Mature but runs through Node.js compat.

### Middleware Ecosystem

**Fastify** — 200+ official plugins. Rate limiting, CORS, JWT, CSRF, session, swagger, caching, load shedding. The most battle-tested ecosystem by far.

**Hono** — Official middleware repo (888 stars): CORS, JWT, Bearer Auth, Basic Auth, Cookie, ETag, Logger, Secure Headers, Compress, Cache. `@hono/zod-openapi` for API docs. Growing rapidly.

**Elysia** — Smaller ecosystem: `elysia-cors` (53 stars), `elysia-jwt` (68 stars), `elysia-bearer` (17 stars). Rate limiting requires community packages.

### TypeScript DX

**Elysia** — Best in class. Automatic type inference for routes, params, bodies, responses. Eden client provides tRPC-like end-to-end type safety. Can slow TypeScript compiler with deeply nested plugin chains.

**Hono** — Very good. `hono/client` provides RPC-style type safety. `hono/validator` + Zod integration for compile-time and runtime checking.

**Fastify** — Good with explicit type providers (`@fastify/type-provider-zod`). More boilerplate than Elysia/Hono.

### Production Stability

**Fastify** — Most stable. Semver-compliant, 7+ years of production use, only 127 open issues despite 35k stars. Used by Microsoft, NearForm.

**Hono** — Stable v4. 304 contributors, active daily maintenance. Multi-runtime constraint forces conservative API design.

**Elysia** — Least stable. 255 open issues. Critical production bugs: WebSocket identity (#1737), ReadableStream corruption (#1772), NODE_ENV behavior bugs (#585, #1303, #1453). Single primary maintainer.

## Decision

**Hono** is selected as the API framework for NOVA.

## Rationale

1. **Runtime portability is an insurance policy.** If Bun proves unstable in production (memory leaks, SSL race conditions documented in the issue tracker), Hono allows deploying on Node.js or Deno with zero code changes. For enterprise software, this escape hatch is invaluable.

2. **SSE streaming works correctly.** The `streamSSE()` helper does not have the binary serialization bug that currently affects Elysia. For LLM token delivery, this is non-negotiable.

3. **Good enough TypeScript DX.** While Elysia's type inference is marginally better, Hono's `hono/client` + Zod validators provide strong end-to-end type safety that meets our needs.

4. **Growing middleware ecosystem.** All essentials (CORS, JWT, rate limiting, validation, OpenAPI) are available. The community is 3x larger than Elysia's.

5. **Stability.** 29k stars, 304 contributors, daily releases. No critical production bugs in the current version.

## Consequences

### What this means for WebSocket

Hono's WebSocket helper does NOT expose Bun's native pub/sub. For NOVA's real-time features, we will:
1. Use Hono's `upgradeWebSocket()` for the WebSocket upgrade handshake
2. For broadcasting, use **Redis pub/sub** at the application layer (required anyway for horizontal scaling across multiple API pods)
3. If Bun-native pub/sub is needed for single-pod performance, drop to `Bun.serve()` WebSocket API for specific endpoints

### What this means for SSE

1. Set `idleTimeout: 0` on the Bun server configuration
2. Send heartbeat comments (`:heartbeat\n\n`) every 15 seconds on all SSE streams
3. Use Hono's `streamSSE()` helper for all streaming endpoints

### What this means for the codebase

```
packages/api/
  src/
    index.ts              # Hono app + Bun.serve()
    routes/               # Route modules (Hono router groups)
    middleware/            # Custom middleware (auth, rate-limit, audit)
    services/             # Domain logic
    ws/                   # WebSocket handlers (using Hono upgrade + Redis pub/sub)
```

### Rejected Alternatives

**Elysia** — Too many critical production bugs (WebSocket identity, SSE corruption). Single maintainer. Bun lock-in with no escape hatch. Revisit if stability improves significantly.

**Fastify** — Best ecosystem but runs through Bun's Node.js compat layer, defeating the purpose of using Bun. If we wanted Fastify, we should just use Node.js everywhere.

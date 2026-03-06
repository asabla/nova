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
import { env } from "./lib/env";

import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { conversationRoutes } from "./routes/conversations";
import { messageRoutes } from "./routes/messages";
import { fileRoutes } from "./routes/files";
import { userRoutes } from "./routes/users";
import { notificationRoutes } from "./routes/notifications";
import { agentRoutes } from "./routes/agents";
import { knowledgeRoutes } from "./routes/knowledge";
import { workspaceRoutes } from "./routes/workspaces";
import { orgRoutes } from "./routes/orgs";
import { promptRoutes } from "./routes/prompts";
import { apiKeyRoutes } from "./routes/api-keys";
import { searchRoutes } from "./routes/search";
import { analyticsRoutes } from "./routes/analytics";
import { modelRoutes } from "./routes/models";
import { auditRoutes } from "./routes/audit";
import { toolRoutes } from "./routes/tools";
import { mcpRoutes } from "./routes/mcp";
import { exportRoutes } from "./routes/export";
import { v1ChatRoutes } from "./routes/v1-chat";
import { sandboxRoutes } from "./routes/sandbox";
import { researchRoutes } from "./routes/research";
import { contentFilter } from "./middleware/content-filter";

const app = new Hono<AppContext>();

// 1. Error handler
app.onError(errorHandler);

// 2. Security headers
app.use("*", secureHeaders());

// 3. CORS
app.use("*", cors({
  origin: env.CORS_ORIGINS.split(","),
  credentials: true,
}));

// 4. Request ID
app.use("*", requestId());

// 5. Logger
app.use("*", logger());

// 6. Public routes
app.route("/api/auth", authRoutes);
app.route("/health", healthRoutes);

// 7. Rate limiting (on API routes)
app.use("/api/*", rateLimiter());

// 8. Auth middleware (everything below requires valid session)
app.use("/api/*", authMiddleware());

// 9. Org scoping
app.use("/api/*", orgScope());

// 10. Content filtering
app.use("/api/*", contentFilter());

// 10. Authenticated routes
app.route("/api/conversations", conversationRoutes);
app.route("/api/conversations", messageRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/users", userRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/org", orgRoutes);
app.route("/api/prompts", promptRoutes);
app.route("/api/api-keys", apiKeyRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/models", modelRoutes);
app.route("/api/org", auditRoutes);
app.route("/api/tools", toolRoutes);
app.route("/api/mcp", mcpRoutes);
app.route("/api/export", exportRoutes);
app.route("/v1/chat", v1ChatRoutes);
app.route("/api/sandbox", sandboxRoutes);
app.route("/api/research", researchRoutes);

export { app };

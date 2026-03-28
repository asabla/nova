import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { requestId } from "./middleware/request-id";
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/error-handler";
import { rateLimiter } from "./middleware/rate-limit";
import { authMiddleware } from "./middleware/auth";
import { orgScope } from "./middleware/org-scope";
import { roleResolver } from "./middleware/role-resolver";
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
import { knowledgeConnectorRoutes } from "./routes/knowledge-connectors";
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
import { artifactRoutes } from "./routes/artifacts";
import { researchRoutes } from "./routes/research";
import { contentFilter } from "./middleware/content-filter";
import { budgetGuard } from "./middleware/budget-guard";
import { mfaGuard } from "./middleware/mfa-guard";
import { importRoutes } from "./routes/import";
import { groupRoutes } from "./routes/groups";
import { folderRoutes } from "./routes/conversation-folders";
import { ssoRoutes, ssoOAuthRoutes } from "./routes/sso";
import { gdprRoutes } from "./routes/gdpr";
import { memoryRoutes } from "./routes/memory";
import { agentToolRoutes } from "./routes/agent-tools";
import { batchRoutes } from "./routes/batch";
import { modelCompareRoutes } from "./routes/model-compare";
import { integrationRoutes } from "./routes/integrations";
import { contentFilterRoutes } from "./routes/content-filter";
import { shortcutRoutes } from "./routes/shortcuts";
import { rateLimitRoutes } from "./routes/rate-limits";
import { domainRoutes } from "./routes/domains";
import { urlPreviewRoutes } from "./routes/url-preview";
import { webhookRoutes } from "./routes/webhooks";
import { voiceRoutes } from "./routes/voice";
import { superAdminRoutes } from "./routes/super-admin";
import { customWorkerRoutes } from "./routes/custom-workers";

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
app.route("/api/sso/oauth", ssoOAuthRoutes);
app.route("/api/webhooks", webhookRoutes);

// 7. Rate limiting (on API routes)
app.use("/api/*", rateLimiter());

// 8. Auth middleware (everything below requires valid session)
app.use("/api/*", authMiddleware());

// 9. Org scoping
app.use("/api/*", orgScope());

// 10. Role resolution (sets userRole from user_profiles)
app.use("/api/*", roleResolver());

// 11. MFA enforcement (Story #6)
app.use("/api/*", mfaGuard());

// 12. Content filtering
app.use("/api/*", contentFilter());

// 13. Budget enforcement (on LLM-calling routes)
app.use("/api/conversations/*/messages", budgetGuard());
app.use("/v1/chat/*", budgetGuard());
app.use("/api/sandbox/*", budgetGuard());
app.use("/api/research/*", budgetGuard());

// 12. Authenticated routes
app.route("/api/conversations", folderRoutes);
app.route("/api/conversations", conversationRoutes);
app.route("/api/conversations", messageRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/users", userRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/knowledge", knowledgeConnectorRoutes);
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
app.route("/api", artifactRoutes);
app.route("/api/research", researchRoutes);
app.route("/api/import", importRoutes);
app.route("/api/groups", groupRoutes);
app.route("/api/sso", ssoRoutes);
app.route("/api/gdpr", gdprRoutes);
app.route("/api/agents", memoryRoutes);
app.route("/api/agents", agentToolRoutes);
app.route("/api/batch", batchRoutes);
app.route("/api/model-compare", modelCompareRoutes);
app.route("/api/integrations", integrationRoutes);
app.route("/api/content", contentFilterRoutes);
app.route("/api/shortcuts", shortcutRoutes);
app.route("/api/org", rateLimitRoutes);
app.route("/api/domains", domainRoutes);
app.route("/api/url", urlPreviewRoutes);
app.route("/api/voice", voiceRoutes);
app.route("/api/super-admin", superAdminRoutes);
app.route("/api/custom-workers", customWorkerRoutes);

export { app };

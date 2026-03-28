import { Hono } from "hono";
import { logger } from "hono/logger";
import { jwtAuth } from "./middleware/jwt-auth";
import { streamRoutes } from "./routes/stream";
import { dbRoutes } from "./routes/db";
import { llmRoutes } from "./routes/llm";
import { vectorRoutes } from "./routes/vectors";
import { storageRoutes } from "./routes/storage";

export type GatewayEnv = {
  Variables: {
    orgId: string;
    conversationId?: string;
    workerId?: string;
    scopes: string[];
  };
};

export const app = new Hono<GatewayEnv>();

// Health check (no auth)
app.get("/health", async (c) => {
  return c.json({ status: "ok" });
});

// Logging
app.use("*", logger());

// JWT auth for all other routes
app.use("*", jwtAuth);

// Route groups
app.route("/stream", streamRoutes);
app.route("/db", dbRoutes);
app.route("/llm", llmRoutes);
app.route("/vectors", vectorRoutes);
app.route("/storage", storageRoutes);

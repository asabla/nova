import { Hono } from "hono";
import { z } from "zod";
import { randomBytes } from "crypto";
import type { AppContext } from "../types/context";
import { knowledgeConnectorService } from "../services/knowledge-connector.service";
import { writeAuditLog } from "../services/audit.service";
import { redis } from "../lib/redis";
import { env } from "../lib/env";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  listSites,
  listSiteDrives,
  listDriveChildren,
  listTeams,
  listTeamChannels,
} from "../lib/microsoft-graph";

const knowledgeConnectorRoutes = new Hono<AppContext>();

// ── Connector CRUD (nested under /:collectionId/connectors) ──

knowledgeConnectorRoutes.get("/:collectionId/connectors", async (c) => {
  const orgId = c.get("orgId");
  const connectors = await knowledgeConnectorService.listConnectors(
    orgId,
    c.req.param("collectionId"),
  );
  return c.json({ data: connectors });
});

const createConnectorSchema = z.object({
  provider: z.enum(["sharepoint", "onedrive", "teams"]),
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  resourceId: z.string().min(1),
  resourcePath: z.string().optional(),
  resourceName: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.number().int().min(60).max(1440).optional(),
  folderFilter: z.string().optional(),
  fileTypeFilter: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

knowledgeConnectorRoutes.post("/:collectionId/connectors", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const collectionId = c.req.param("collectionId");
  const body = createConnectorSchema.parse(await c.req.json());

  const connector = await knowledgeConnectorService.createConnector(orgId, userId, {
    knowledgeCollectionId: collectionId,
    ...body,
  });

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.connector.create",
    resourceType: "knowledge_connector",
    resourceId: connector.id,
    details: { provider: body.provider, resourceId: body.resourceId },
  });

  return c.json(connector, 201);
});

knowledgeConnectorRoutes.get("/:collectionId/connectors/:connectorId", async (c) => {
  const orgId = c.get("orgId");
  const connector = await knowledgeConnectorService.getConnector(
    orgId,
    c.req.param("connectorId"),
  );
  return c.json(connector);
});

const updateConnectorSchema = z.object({
  resourceId: z.string().min(1).optional(),
  resourcePath: z.string().optional(),
  resourceName: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.number().int().min(60).max(1440).optional(),
  folderFilter: z.string().nullable().optional(),
  fileTypeFilter: z.array(z.string()).nullable().optional(),
  clientSecret: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

knowledgeConnectorRoutes.patch("/:collectionId/connectors/:connectorId", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = updateConnectorSchema.parse(await c.req.json());

  const connector = await knowledgeConnectorService.updateConnector(
    orgId,
    c.req.param("connectorId"),
    body,
  );

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.connector.update",
    resourceType: "knowledge_connector",
    resourceId: c.req.param("connectorId"),
  });

  return c.json(connector);
});

knowledgeConnectorRoutes.delete("/:collectionId/connectors/:connectorId", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  await knowledgeConnectorService.deleteConnector(orgId, c.req.param("connectorId"));

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.connector.delete",
    resourceType: "knowledge_connector",
    resourceId: c.req.param("connectorId"),
  });

  return c.body(null, 204);
});

knowledgeConnectorRoutes.post("/:collectionId/connectors/:connectorId/test", async (c) => {
  const orgId = c.get("orgId");
  const result = await knowledgeConnectorService.testConnection(
    orgId,
    c.req.param("connectorId"),
  );
  return c.json(result);
});

knowledgeConnectorRoutes.post("/:collectionId/connectors/:connectorId/sync", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const connectorId = c.req.param("connectorId");

  const result = await knowledgeConnectorService.triggerSync(orgId, connectorId);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.connector.sync_trigger",
    resourceType: "knowledge_connector",
    resourceId: connectorId,
  });

  return c.json(result);
});

// ── Delegated OAuth for Interactive Browsing ──

const BROWSE_TOKEN_PREFIX = "graph-browse:";
const BROWSE_TOKEN_TTL = 1800; // 30 minutes

// In-memory state store for OAuth CSRF (same pattern as sso.ts)
const oauthBrowseStateStore = new Map<
  string,
  { tenantId: string; clientId: string; clientSecret: string; userId: string; createdAt: number }
>();

// Cleanup expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthBrowseStateStore) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthBrowseStateStore.delete(key);
  }
}, 5 * 60 * 1000);

const authorizeSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

knowledgeConnectorRoutes.post("/connectors/oauth/authorize", async (c) => {
  const userId = c.get("userId");
  const body = authorizeSchema.parse(await c.req.json());

  const state = randomBytes(32).toString("hex");
  oauthBrowseStateStore.set(state, {
    ...body,
    userId,
    createdAt: Date.now(),
  });

  const redirectUri = `${env.BETTER_AUTH_URL}/api/knowledge/connectors/oauth/callback`;
  const authorizeUrl = buildAuthorizeUrl({
    tenantId: body.tenantId,
    clientId: body.clientId,
    redirectUri,
    state,
  });

  return c.json({ authorizeUrl, state });
});

// OAuth callback — exchanges code for tokens, stores in Redis
knowledgeConnectorRoutes.get("/connectors/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    const desc = c.req.query("error_description") ?? error;
    return c.redirect(`${env.APP_URL}/knowledge?oauth_error=${encodeURIComponent(desc)}`);
  }

  if (!code || !state) {
    return c.redirect(`${env.APP_URL}/knowledge?oauth_error=${encodeURIComponent("Missing code or state")}`);
  }

  const stored = oauthBrowseStateStore.get(state);
  if (!stored) {
    return c.redirect(`${env.APP_URL}/knowledge?oauth_error=${encodeURIComponent("Invalid or expired state")}`);
  }
  oauthBrowseStateStore.delete(state);

  if (Date.now() - stored.createdAt > 10 * 60 * 1000) {
    return c.redirect(`${env.APP_URL}/knowledge?oauth_error=${encodeURIComponent("OAuth request expired")}`);
  }

  try {
    const redirectUri = `${env.BETTER_AUTH_URL}/api/knowledge/connectors/oauth/callback`;
    const tokens = await exchangeCodeForTokens({
      tenantId: stored.tenantId,
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
      code,
      redirectUri,
    });

    // Store access token in Redis with TTL for browse session
    const browseKey = `${BROWSE_TOKEN_PREFIX}${stored.userId}`;
    await redis.setex(browseKey, BROWSE_TOKEN_TTL, tokens.accessToken);

    return c.redirect(`${env.APP_URL}/knowledge?oauth_success=true`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    return c.redirect(`${env.APP_URL}/knowledge?oauth_error=${encodeURIComponent(msg)}`);
  }
});

// ── Browse Endpoints (use delegated token from Redis) ──

async function getBrowseToken(userId: string): Promise<string> {
  const token = await redis.get(`${BROWSE_TOKEN_PREFIX}${userId}`);
  if (!token) {
    throw new Error("No browse session. Please sign in with Microsoft first.");
  }
  return token;
}

knowledgeConnectorRoutes.get("/connectors/browse/sites", async (c) => {
  const userId = c.get("userId");
  const search = c.req.query("search");
  const token = await getBrowseToken(userId);
  const sites = await listSites(token, search);
  return c.json({ data: sites });
});

knowledgeConnectorRoutes.get("/connectors/browse/drives/:siteId", async (c) => {
  const userId = c.get("userId");
  const token = await getBrowseToken(userId);
  const drives = await listSiteDrives(token, c.req.param("siteId"));
  return c.json({ data: drives });
});

knowledgeConnectorRoutes.get("/connectors/browse/folders/:driveId", async (c) => {
  const userId = c.get("userId");
  const path = c.req.query("path");
  const token = await getBrowseToken(userId);
  const items = await listDriveChildren(token, c.req.param("driveId"), path ?? undefined);
  return c.json({ data: items });
});

knowledgeConnectorRoutes.get("/connectors/browse/teams", async (c) => {
  const userId = c.get("userId");
  const token = await getBrowseToken(userId);
  const teams = await listTeams(token);
  return c.json({ data: teams });
});

knowledgeConnectorRoutes.get("/connectors/browse/channels/:teamId", async (c) => {
  const userId = c.get("userId");
  const token = await getBrowseToken(userId);
  const channels = await listTeamChannels(token, c.req.param("teamId"));
  return c.json({ data: channels });
});

export { knowledgeConnectorRoutes };

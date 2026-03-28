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

// ── Git providers use a simpler schema (no Azure AD, just URL + token) ──

const GIT_PROVIDERS = ["github", "gitlab", "bitbucket", "git"] as const;
const M365_PROVIDERS = ["sharepoint", "onedrive", "teams"] as const;

const createM365ConnectorSchema = z.object({
  provider: z.enum(M365_PROVIDERS),
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

const createGitConnectorSchema = z.object({
  provider: z.enum(GIT_PROVIDERS),
  repoUrl: z.string().url(),
  branch: z.string().default("main"),
  authToken: z.string().optional(),
  resourceName: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.number().int().min(60).max(1440).optional(),
  includeGlobs: z.array(z.string()).optional(),
  excludeGlobs: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createConnectorSchema = z.union([createM365ConnectorSchema, createGitConnectorSchema]);

knowledgeConnectorRoutes.post("/:collectionId/connectors", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const collectionId = c.req.param("collectionId");
  const body = createConnectorSchema.parse(await c.req.json());

  let connectorInput: Parameters<typeof knowledgeConnectorService.createConnector>[2];

  if ("repoUrl" in body) {
    // Git provider — map to connector fields
    connectorInput = {
      knowledgeCollectionId: collectionId,
      provider: body.provider,
      // Git connectors don't use Azure AD fields — use placeholder values
      tenantId: "git",
      clientId: "git",
      clientSecret: body.authToken ?? "",
      resourceId: body.repoUrl,
      resourceName: body.resourceName ?? body.repoUrl.split("/").slice(-1)[0]?.replace(".git", ""),
      syncEnabled: body.syncEnabled,
      syncIntervalMinutes: body.syncIntervalMinutes,
      metadata: {
        ...body.metadata,
        repoUrl: body.repoUrl,
        branch: body.branch,
        includeGlobs: body.includeGlobs ?? [],
        excludeGlobs: body.excludeGlobs ?? [],
      },
    };
  } else {
    // M365 provider — pass through as-is
    connectorInput = {
      knowledgeCollectionId: collectionId,
      ...body,
    };
  }

  const connector = await knowledgeConnectorService.createConnector(orgId, userId, connectorInput);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.connector.create",
    resourceType: "knowledge_connector",
    resourceId: connector.id,
    details: { provider: body.provider },
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

// ── Git Repository Validation ──

function parseGitRepoUrl(url: string): { provider: "github" | "gitlab"; owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (pathParts.length < 2) return null;
    const [owner, repo] = pathParts;
    if (parsed.hostname === "github.com") return { provider: "github", owner, repo };
    if (parsed.hostname === "gitlab.com") return { provider: "gitlab", owner, repo };
    return null;
  } catch {
    return null;
  }
}

async function validateViaApi(
  parsed: { provider: "github" | "gitlab"; owner: string; repo: string },
  token?: string,
): Promise<{ valid: boolean; defaultBranch?: string; error?: string }> {
  try {
    if (parsed.provider === "github") {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Nova/1.0",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
        { headers },
      );
      if (!resp.ok) {
        if (resp.status === 404) return { valid: false, error: "Repository not found" };
        if (resp.status === 401 || resp.status === 403) return { valid: false, error: "Authentication failed — check your access token" };
        return { valid: false, error: `GitHub API returned ${resp.status}` };
      }
      const data = (await resp.json()) as { default_branch: string };
      return { valid: true, defaultBranch: data.default_branch };
    }

    if (parsed.provider === "gitlab") {
      const projectId = encodeURIComponent(`${parsed.owner}/${parsed.repo}`);
      const headers: Record<string, string> = {};
      if (token) headers["PRIVATE-TOKEN"] = token;
      const resp = await fetch(`https://gitlab.com/api/v4/projects/${projectId}`, { headers });
      if (!resp.ok) {
        if (resp.status === 404) return { valid: false, error: "Repository not found" };
        if (resp.status === 401 || resp.status === 403) return { valid: false, error: "Authentication failed — check your access token" };
        return { valid: false, error: `GitLab API returned ${resp.status}` };
      }
      const data = (await resp.json()) as { default_branch: string };
      return { valid: true, defaultBranch: data.default_branch };
    }

    return { valid: false, error: "Unsupported provider" };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Validation failed" };
  }
}

const validateGitRepoSchema = z.object({
  repoUrl: z.string().url(),
  authToken: z.string().optional(),
});

knowledgeConnectorRoutes.post("/connectors/git/validate", async (c) => {
  const body = validateGitRepoSchema.parse(await c.req.json());

  try {
    // Use provider API to validate (no git binary needed on API server)
    const parsed = parseGitRepoUrl(body.repoUrl);
    if (parsed) {
      const result = await validateViaApi(parsed, body.authToken);
      if (result.valid) return c.json(result);
      return c.json(result, 422);
    }

    // Fallback for non-GitHub/GitLab URLs: use git ls-remote
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);

    let authUrl = body.repoUrl;
    if (body.authToken) {
      const url = new URL(body.repoUrl);
      url.username = "x-access-token";
      url.password = body.authToken;
      authUrl = url.toString();
    }

    const { stdout } = await exec("git", ["ls-remote", "--symref", authUrl, "HEAD"], {
      timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });

    const branchMatch = stdout.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    return c.json({ valid: true, defaultBranch: branchMatch?.[1] ?? "main" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    let error = `Failed to access repository: ${message}`;
    if (message.includes("Authentication") || message.includes("403") || message.includes("401")) {
      error = "Authentication failed — check your access token";
    } else if (message.includes("not found") || message.includes("404")) {
      error = "Repository not found";
    }
    return c.json({ valid: false, error }, 422);
  }
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

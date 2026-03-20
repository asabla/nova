import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { integrationService, type IntegrationType } from "../services/integration.service";
import { writeAuditLog } from "../services/audit.service";
import { requireRole } from "../middleware/rbac";

const integrationTypeSchema = z.enum(["slack", "teams", "email", "google-drive", "webhook"]);

const slackConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channel: z.string().optional(),
  events: z.array(z.string()).optional(),
});

const teamsConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channel: z.string().optional(),
});

const emailConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  from: z.string().email(),
  username: z.string().optional(),
  password: z.string().optional(),
  secure: z.boolean().optional(),
});

const googleDriveConfigSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  syncFolder: z.string().optional(),
});

const webhookConfigSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
  method: z.enum(["POST", "PUT"]).optional(),
});

const upsertSchema = z.object({
  isEnabled: z.boolean().default(true),
  config: z.record(z.unknown()),
});

const integrationRoutes = new Hono<AppContext>();

// GET / - List all configured integrations
integrationRoutes.get("/", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const integrations = await integrationService.listIntegrations(orgId);
  return c.json({ data: integrations });
});

// GET /:type - Get specific integration config
integrationRoutes.get("/:type", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const type = integrationTypeSchema.safeParse(c.req.param("type"));
  if (!type.success) {
    return c.json({ error: "Invalid integration type" }, 400);
  }

  const integration = await integrationService.getIntegration(orgId, type.data);
  if (!integration) {
    return c.json({ error: "Integration not configured" }, 404);
  }

  return c.json(integration);
});

// PUT /:type - Create/update integration
integrationRoutes.put(
  "/:type",
  requireRole("org-admin"),
  zValidator("json", upsertSchema),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const type = integrationTypeSchema.safeParse(c.req.param("type"));
    if (!type.success) {
      return c.json({ error: "Invalid integration type" }, 400);
    }

    const body = c.req.valid("json");

    // Validate config shape based on type
    const configValidation = validateConfigForType(type.data, body.config);
    if (!configValidation.success) {
      return c.json({ error: "Invalid config", details: configValidation.errors }, 400);
    }

    const integration = await integrationService.upsertIntegration(
      orgId,
      type.data,
      body.config,
      body.isEnabled,
    );

    await writeAuditLog({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "integration.upsert",
      resourceType: "integration",
      resourceId: type.data,
      details: { isEnabled: body.isEnabled },
    });

    return c.json(integration);
  },
);

// DELETE /:type - Remove integration
integrationRoutes.delete("/:type", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const type = integrationTypeSchema.safeParse(c.req.param("type"));
  if (!type.success) {
    return c.json({ error: "Invalid integration type" }, 400);
  }

  await integrationService.deleteIntegration(orgId, type.data);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "integration.delete",
    resourceType: "integration",
    resourceId: type.data,
  });

  return c.body(null, 204);
});

// POST /:type/test - Test connectivity
integrationRoutes.post("/:type/test", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const type = integrationTypeSchema.safeParse(c.req.param("type"));
  if (!type.success) {
    return c.json({ error: "Invalid integration type" }, 400);
  }

  const result = await integrationService.testIntegration(orgId, type.data);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "integration.test",
    resourceType: "integration",
    resourceId: type.data,
    details: { success: result.success },
  });

  return c.json(result);
});

// POST /webhooks - List webhook endpoints (convenience alias)
integrationRoutes.post("/webhooks", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const integration = await integrationService.getIntegration(orgId, "webhook");
  if (!integration) {
    return c.json({ data: [] });
  }
  return c.json({ data: [integration] });
});

// POST /webhooks/:id/trigger - Manually trigger webhook
integrationRoutes.post("/webhooks/:id/trigger", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const integration = await integrationService.getIntegration(orgId, "webhook");

  if (!integration || !integration.isEnabled) {
    return c.json({ error: "Webhook integration not configured or disabled" }, 404);
  }

  const config = integration.config;
  const url = config.url as string;
  const method = (config.method as string) ?? "POST";
  const secret = config.secret as string | undefined;

  try {
    const payload = {
      event: "manual_trigger",
      triggeredBy: userId,
      timestamp: new Date().toISOString(),
      source: "nova",
    };

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify(payload),
    });

    await writeAuditLog({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "integration.webhook.trigger",
      resourceType: "integration",
      resourceId: "webhook",
      details: { status: response.status },
    });

    return c.json({
      success: response.ok,
      status: response.status,
      message: response.ok ? "Webhook triggered successfully" : `Webhook returned status ${response.status}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed";
    return c.json({ success: false, message }, 502);
  }
});

// --- Config validation helper ---

function validateConfigForType(
  type: IntegrationType,
  config: Record<string, unknown>,
): { success: true } | { success: false; errors: z.ZodError["errors"] } {
  let schema: z.ZodType;

  switch (type) {
    case "slack":
      schema = slackConfigSchema;
      break;
    case "teams":
      schema = teamsConfigSchema;
      break;
    case "email":
      schema = emailConfigSchema;
      break;
    case "google-drive":
      schema = googleDriveConfigSchema;
      break;
    case "webhook":
      schema = webhookConfigSchema;
      break;
    default:
      return { success: true };
  }

  const result = schema.safeParse(config);
  if (result.success) {
    return { success: true };
  }
  return { success: false, errors: result.error.errors };
}

export { integrationRoutes };

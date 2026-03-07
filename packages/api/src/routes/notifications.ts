import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { notifications } from "@nova/shared/schemas";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { parsePagination, buildPaginatedResponse } from "@nova/shared/utils";
import { notificationService, upsertPreference, getStructuredPrefs } from "../services/notification.service";

const notificationsRouter = new Hono<AppContext>();

// --- List notifications ---

notificationsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const page = Number(c.req.query("page") ?? 1);
  const pageSize = Number(c.req.query("pageSize") ?? 20);
  const { offset, limit } = parsePagination({ page, pageSize });

  const where = and(
    eq(notifications.userId, userId),
    eq(notifications.orgId, orgId),
    isNull(notifications.deletedAt),
  );

  const [data, countResult] = await Promise.all([
    db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).offset(offset).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(where),
  ]);

  return c.json(buildPaginatedResponse(data, countResult[0]?.count ?? 0, { offset, limit, page, pageSize }));
});

// --- Unread count ---

notificationsRouter.get("/unread-count", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.orgId, orgId),
      eq(notifications.isRead, false),
      isNull(notifications.deletedAt),
    ));

  return c.json({ count: result[0]?.count ?? 0 });
});

// --- Mark single notification as read ---

notificationsRouter.post("/:id/read", async (c) => {
  const userId = c.get("userId");
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, c.req.param("id")), eq(notifications.userId, userId)))
    .returning();
  return c.json(result[0] ?? { ok: false });
});

// --- Mark all as read ---

notificationsRouter.post("/read-all", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId), eq(notifications.isRead, false)));
  return c.json({ ok: true });
});

// --- Preferences ---

// GET /preferences - returns structured preferences with defaults applied (story #163)
notificationsRouter.get("/preferences", async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");

  const prefs = await getStructuredPrefs(orgId, userId);
  return c.json({ data: prefs });
});

// Fine-grained preference update schema matching the four preference keys
const patchPrefsSchema = z.object({
  emailOnShare: z.boolean().optional(),
  emailOnMention: z.boolean().optional(),
  emailOnAgentComplete: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference must be provided",
});

/**
 * Maps fine-grained preference keys to (notificationType, channel) pairs
 * stored in the notificationPreferences table.
 */
const PREF_KEY_MAP: Record<string, { notificationType: string; channel: string }> = {
  emailOnShare: { notificationType: "conversation_shared", channel: "email" },
  emailOnMention: { notificationType: "mention", channel: "email" },
  emailOnAgentComplete: { notificationType: "agent_complete", channel: "email" },
  inAppEnabled: { notificationType: "all", channel: "in_app" },
};

// PATCH /preferences - update one or more preferences (story #163)
notificationsRouter.patch("/preferences", zValidator("json", patchPrefsSchema), async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const body = c.req.valid("json");

  const results = [];

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    const mapping = PREF_KEY_MAP[key];
    if (!mapping) continue;

    const result = await upsertPreference(
      orgId,
      userId,
      mapping.notificationType,
      mapping.channel,
      value as boolean,
    );
    results.push({ key, ...result });
  }

  // Return the full structured preferences after the update
  const updated = await getStructuredPrefs(orgId, userId);
  return c.json({ data: updated, changed: results });
});

// PUT /preferences - set a single (notificationType, channel) preference (legacy/granular)
const prefSchema = z.object({
  notificationType: z.string(),
  channel: z.enum(["in_app", "email", "webhook", "slack"]),
  isEnabled: z.boolean(),
});

notificationsRouter.put("/preferences", zValidator("json", prefSchema), async (c) => {
  const userId = c.get("userId");
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const result = await upsertPreference(
    orgId,
    userId,
    data.notificationType,
    data.channel,
    data.isEnabled,
  );
  return c.json(result);
});

// --- Send email notification (stub) ---

const emailNotificationSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10_000),
  templateId: z.string().optional(),
  templateVars: z.record(z.string()).optional(),
});

notificationsRouter.post("/email", zValidator("json", emailNotificationSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  // Stub: No email service configured yet. Log the request and return success.
  console.log(`[email-stub] org=${orgId} from=${userId} to=${data.to} subject="${data.subject}"`);

  // Persist as an in-app notification so there is a record
  const notification = await notificationService.create({
    orgId,
    userId,
    type: "email_queued",
    title: `Email to ${data.to}: ${data.subject}`,
    body: data.body.slice(0, 500),
  });

  return c.json({
    ok: true,
    status: "queued",
    message: "Email service not configured. Notification logged as in-app record.",
    notificationId: notification?.id ?? null,
  }, 202);
});

// --- Send webhook notification ---

const webhookNotificationSchema = z.object({
  url: z.string().url(),
  event: z.string().min(1).max(200),
  payload: z.record(z.unknown()).optional(),
  secret: z.string().optional(),
});

notificationsRouter.post("/webhook", zValidator("json", webhookNotificationSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const webhookPayload = {
    event: data.event,
    orgId,
    timestamp: new Date().toISOString(),
    data: data.payload ?? {},
  };

  // Compute HMAC signature if secret is provided
  let signature: string | undefined;
  if (data.secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(data.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(JSON.stringify(webhookPayload)),
    );
    signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "NOVA-Webhook/1.0",
      "X-Nova-Event": data.event,
    };
    if (signature) {
      headers["X-Nova-Signature-256"] = `sha256=${signature}`;
    }

    const response = await fetch(data.url, {
      method: "POST",
      headers,
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    // Record the attempt
    await notificationService.create({
      orgId,
      userId,
      type: "webhook_sent",
      title: `Webhook: ${data.event}`,
      body: `Delivered to ${data.url} - HTTP ${response.status}`,
    });

    return c.json({
      ok: response.ok,
      status: response.status,
      event: data.event,
      url: data.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Record the failure
    await notificationService.create({
      orgId,
      userId,
      type: "webhook_failed",
      title: `Webhook failed: ${data.event}`,
      body: `Failed to deliver to ${data.url}: ${message}`,
    });

    return c.json({
      ok: false,
      error: "Webhook delivery failed",
      message,
      event: data.event,
      url: data.url,
    }, 502);
  }
});

export { notificationsRouter as notificationRoutes };

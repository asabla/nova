import { Hono } from "hono";
import { eq, desc, and, isNull, gte, lte, ilike, sql } from "drizzle-orm";
import type { AppContext } from "../../types/context";
import { db } from "../../lib/db";
import { auditLogs, users } from "@nova/shared/schemas";

const adminAuditRoutes = new Hono<AppContext>();

// Cross-org audit log
adminAuditRoutes.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Number(c.req.query("offset") ?? 0);
  const orgId = c.req.query("orgId");
  const action = c.req.query("action");
  const since = c.req.query("since");
  const until = c.req.query("until");

  const resourceType = c.req.query("resourceType");

  const conditions: any[] = [];
  if (orgId) conditions.push(eq(auditLogs.orgId, orgId));
  if (action) conditions.push(ilike(auditLogs.action, `%${action}%`));
  if (since) conditions.push(gte(auditLogs.createdAt, new Date(since)));
  if (until) conditions.push(lte(auditLogs.createdAt, new Date(until)));
  if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));

  const result = await db
    .select({
      id: auditLogs.id,
      orgId: auditLogs.orgId,
      actorId: auditLogs.actorId,
      actorType: auditLogs.actorType,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return c.json({ data: result, total: count });
});

export { adminAuditRoutes };

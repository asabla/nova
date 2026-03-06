import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { auditLogs } from "@nova/shared/schemas";
import { requireRole } from "../middleware/rbac";
import { parsePagination } from "@nova/shared/utils";

const auditRoutes = new Hono<AppContext>();

auditRoutes.get("/audit-logs", requireRole("org-admin"), async (c) => {
  const orgId = c.get("orgId");
  const { limit, offset } = parsePagination(c.req.query());
  const action = c.req.query("action");

  const conditions = [eq(auditLogs.orgId, orgId)];
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  const result = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(...conditions));

  return c.json({ data: result, total: count });
});

export { auditRoutes };
